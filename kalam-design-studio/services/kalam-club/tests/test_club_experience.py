"""Run with unittest using the Club runtime dependencies; never uses production data."""
import os
import unittest
import uuid
from unittest.mock import patch
from datetime import timedelta

os.environ.update(CLUB_DATABASE_URL="sqlite://", CLUB_SESSION_SECRET="s" * 40,
                  CLUB_INTERNAL_SIGNING_SECRET="i" * 40, CLUB_FIELD_ENCRYPTION_KEY="e" * 40)
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_session
from app.main import app, current_member, current_admin
from app.models import Member, ClubAttachment, Reward, RewardKind, FulfillmentMode, UploadStatus, utcnow, ClubAdmin, ContentSubmission, ContentStatus, PointEntry
from app.domain import review_submission
from app.points import collect_points
from app.club_policy import RULES_VERSION
from app.storage import validate_upload, validate_uploaded_media_signature


class ClubExperienceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine, expire_on_commit=False)()
        self.member = Member(phone="+989120000001", full_name="کاربر آزمایشی", city="گلبهار")
        self.db.add(self.member); self.db.commit()
        app.dependency_overrides[get_session] = lambda: self.db
        app.dependency_overrides[current_member] = lambda: self.member
        self.client = TestClient(app, base_url="https://testserver")

    def tearDown(self):
        app.dependency_overrides.clear(); self.db.close(); self.engine.dispose()

    def test_rules_are_versioned_and_do_not_complete_profile(self):
        self.assertEqual(self.client.post('/api/me/rules', json={'version': 'old'}).status_code, 422)
        response = self.client.post('/api/me/rules', json={'version': RULES_VERSION})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()['member']['profileComplete'])
        self.assertEqual(response.json()['member']['rulesVersion'], RULES_VERSION)
        accepted = self.member.rules_accepted_at
        self.client.post('/api/me/rules', json={'version': RULES_VERSION})
        self.assertEqual(accepted, self.member.rules_accepted_at)

    def test_content_requires_onboarding_and_preserves_category_and_text(self):
        payload = {'content_category': 'literature', 'items': [{'text': 'شعر آزمایشی', 'caption': 'اثر خودم'}]}
        self.assertEqual(self.client.post('/api/content/submissions', json=payload).status_code, 422)
        self.member.rules_version = RULES_VERSION; self.member.agreement_accepted_at = utcnow(); self.db.commit()
        self.assertEqual(self.client.post('/api/content/submissions', json={**payload, 'content_category': 'invalid'}).status_code, 422)
        response = self.client.post('/api/content/submissions', json=payload)
        self.assertEqual(response.status_code, 201, response.text)
        item = self.client.get('/api/content/submissions').json()['submissions'][0]
        self.assertEqual(item['contentCategory'], 'literature')
        self.assertEqual(item['items'][0]['text'], 'شعر آزمایشی')
        other = Member(phone='+989120000002', full_name='دیگری', city='چناران')
        self.db.add(other); self.db.commit()
        app.dependency_overrides[current_member] = lambda: other
        self.assertEqual(self.client.get('/api/content/submissions').json()['submissions'], [])

    def test_logout_without_valid_cookie_is_successful_and_clears_cookie(self):
        response = self.client.post('/api/auth/logout')
        self.assertEqual(response.status_code, 204)
        self.assertIn('Max-Age=0', response.headers['set-cookie'])

    def test_public_media_does_not_bypass_quarantine(self):
        attachment = ClubAttachment(storage_key='test/image.jpg', original_filename='image.jpg', content_type='image/jpeg', bytes=20, status=UploadStatus.QUARANTINED)
        self.db.add(attachment); self.db.flush()
        reward = Reward(title='هدیه', description='', kind=RewardKind.PARTNER_BENEFIT, fulfillment_mode=FulfillmentMode.MANUAL, points_cost=10, active=True, image_attachment_id=attachment.id)
        self.db.add(reward); self.db.commit()
        self.assertEqual(self.client.get(f'/api/public-media/{attachment.id}').status_code, 404)
        attachment.status=UploadStatus.AVAILABLE; self.db.commit()
        with patch('app.main.download_url', return_value='https://example.org/test.jpg'):
            response=self.client.get(f'/api/public-media/{attachment.id}', follow_redirects=False)
            self.assertEqual(response.status_code,307)
        reward.active=False; self.db.commit()
        self.assertEqual(self.client.get(f'/api/public-media/{attachment.id}').status_code,404)

    def test_member_uploads_are_limited_to_verified_media(self):
        self.assertEqual(validate_upload("clip.mp4", 10, "video/mp4"), ("clip.mp4", "video/mp4"))
        with self.assertRaises(Exception):
            validate_upload("invoice.pdf", 10, "application/pdf")
        with self.assertRaises(Exception):
            validate_upload("photo.jpg", 10, "application/pdf")
        validate_uploaded_media_signature("photo.jpg", "image/jpeg", b"\xff\xd8\xff\xe0test")
        with self.assertRaises(Exception):
            validate_uploaded_media_signature("photo.jpg", "image/jpeg", b"<html>not-an-image")

    def test_showcase_only_lists_available_rewards_and_requires_admin(self):
        self.assertEqual(self.client.get('/api/admin/showcase-rewards').status_code, 401)
        for title, active, stock in [('فعال',True,5),('ناموجود',True,0),('غیرفعال',False,5)]:
            self.db.add(Reward(title=title, description='', kind=RewardKind.PARTNER_BENEFIT, fulfillment_mode=FulfillmentMode.MANUAL, points_cost=10, active=active, stock_remaining=stock))
        self.db.commit()
        with patch('app.main.current_admin') as admin:
            response=self.client.get('/api/admin/showcase-rewards')
            self.assertEqual(response.status_code,200,response.text)
            self.assertEqual([item['title'] for item in response.json()['rewards']],['فعال'])

    def test_welcome_and_content_points_are_collectable_once_with_a_reason(self):
        self.member.rules_version = RULES_VERSION
        profile = {
            'full_name': 'کاربر آزمایشی', 'city': 'گلبهار', 'content_types': [], 'skills': [],
            'credit_label': 'بدون نام', 'platform_handles': {}, 'marketing_sms_allowed': False,
            'agreement_accepted': True,
        }
        response = self.client.put('/api/me', json=profile)
        self.assertEqual(response.status_code, 200, response.text)
        welcome = self.db.query(PointEntry).filter_by(event_key=f'welcome:{self.member.id}').one()
        self.assertEqual(welcome.amount, 10)
        self.assertIsNone(welcome.received_at)
        member = collect_points(self.db, self.member.id, welcome.id); self.db.commit()
        self.assertEqual(member.score, 10)
        collect_points(self.db, self.member.id, welcome.id); self.db.commit()
        self.assertEqual(self.member.score, 10)
        submission = ContentSubmission(member_id=self.member.id, credit_label='بدون نام', status=ContentStatus.PENDING)
        self.db.add(submission); self.db.flush()
        admin = ClubAdmin(external_id='reviewer', display_name='مدیر بررسی', roles=['club_admin'])
        self.db.add(admin); self.db.flush()
        review_submission(self.db, admin, submission, 'approved', 25, 'محتوا قابل انتشار است.'); self.db.commit()
        award = self.db.query(PointEntry).filter_by(event_key=f'content:{submission.id}').one()
        self.assertEqual((award.amount, award.title, award.submission_id), (25, 'تأیید محتوای شما', submission.id))
        self.assertIsNone(award.received_at)
        collect_points(self.db, self.member.id, award.id); self.db.commit()
        self.assertEqual(self.member.score, 35)


if __name__ == '__main__': unittest.main()
