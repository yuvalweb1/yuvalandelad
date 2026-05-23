export function generateSampleText() {
  // Generates a synthetic WhatsApp text with clear bias patterns
  const authors = ['Maya', 'Yoav', 'Noa', 'Daniel', 'Talia'];
  const tplShort = ['חחחחח','lol','😂😂','אש 🔥','אין מצב','כן','ברור','okay','💀','❤️'];
  const tplMid = ['מי בא בערב?','where are we meeting','בואו ניפגש מחר','מה השעה?','איפה אתם?','tomorrow at 8?'];
  const tplLong = [
    'אז חשבתי על כל הסיפור של אתמול והגעתי למסקנה שאולי כדאי שנדבר',
    'I have a whole story to tell you guys about what happened today',
    'אני חייבת לספר לכם משהו מטורף שקרה לי בדרך הבוקר',
  ];
  const tplNight = ['מישהו ער?','cant sleep','אני לא נרדמת','whos up?'];
  const lines = [];
  const start = new Date();
  start.setMonth(start.getMonth() - 3);
  for (let day = 0; day < 90; day++) {
    const date = new Date(start);
    date.setDate(date.getDate() + day);
    const isBurst = Math.random() < 0.08;
    const dailyCount = isBurst ? 60 + Math.floor(Math.random() * 50) : Math.floor(Math.random() * 28) + 8;
    for (let i = 0; i < dailyCount; i++) {
      const r = Math.random();
      let hour;
      if (r < 0.1) hour = Math.floor(Math.random() * 6);
      else if (r < 0.3) hour = 8 + Math.floor(Math.random() * 3);
      else if (r < 0.65) hour = 12 + Math.floor(Math.random() * 6);
      else hour = 18 + Math.floor(Math.random() * 6);
      const minute = Math.floor(Math.random() * 60);
      const author = authors[Math.floor(Math.random() * authors.length)];
      let text;
      const tr = Math.random();
      if (hour < 6) text = tplNight[Math.floor(Math.random() * tplNight.length)];
      else if (tr < 0.55) text = tplShort[Math.floor(Math.random() * tplShort.length)];
      else if (tr < 0.85) text = tplMid[Math.floor(Math.random() * tplMid.length)];
      else text = tplLong[Math.floor(Math.random() * tplLong.length)];
      const d = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
      const t = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      lines.push(`${d}, ${t} - ${author}: ${text}`);
    }
  }
  return lines.join('\n');
}
