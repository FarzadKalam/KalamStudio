export default function ClubIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    city_nature: <><path d="m12 2 6 7h-3l5 7H4l5-7H6z" /><path d="M12 16v6" /></>,
    people: <><path d="M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5Z" /><path d="M8 10h8M8 14h5" /></>,
    news_photo: <><rect x="2" y="5" width="20" height="15" rx="3" /><circle cx="12" cy="12" r="4" /><path d="m7 5 2-3h6l2 3" /></>,
    news: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h3M8 18h8" /></>,
    literature: <><path d="m4 16 12-12a3 3 0 0 1 4 4L8 20l-5 1zM14 6l4 4M3 21h18" /></>,
    art: <><path d="M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4c-2-1 0-3 2-3h2c5 0 3-11-6-11Z" /><path d="M7 9h.01M11 6h.01M16 8h.01M6 14h.01" /></>,
    other: <><path d="M12 5v14M5 12h14" /><circle cx="12" cy="12" r="10" /></>,
    gift: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v9h14v-9M12 8v13" /><path d="M12 8C3 8 5 0 9 3l3 5c9 0 7-8 3-5z" /></>,
    history: <><path d="M3 10a9 9 0 1 1 1 7M3 4v6h6M12 7v6l4 2" /></>,
    profile: <><circle cx="12" cy="7" r="4" /><path d="M4 22v-3a8 8 0 0 1 16 0v3" /></>,
  };
  return <svg className="club-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.other}</svg>;
}
