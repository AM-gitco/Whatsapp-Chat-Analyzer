# WhatsApp Chat Analyzer

**WhatsApp Chat Analyzer** is a client-side web app that extracts insights from an exported WhatsApp chat `.txt` file. It provides message/word/emoji statistics, activity timelines, streaks and breaks analysis, charts, a word cloud, and PDF/image export — all in the browser (no backend).

---

## Demo / Screenshots
*(Replace with your screenshots or GIFs in `/docs` or GitHub releases)*

---

## Features
- Upload exported WhatsApp chat (`.txt`) and analyze instantly in-browser.
- Enter display names for two participants (you and friend) for personalized stats.
- Overview: days talking, avg messages/day, total messages, total words, characters, emojis.
- Charts: comparison chart, activity timeline, day-of-week and hour-of-day charts (Chart.js).
- Emoji analysis (top emojis per user).
- Message analysis (most repeated messages).
- Word analysis and top words per user.
- Activity: chatting streaks, breaks between conversations.
- Insights: longest streak, most active time/day, favorite emoji.
- Word cloud generation and downloadable image.
- Export analysis report as PDF (html2canvas + jsPDF).
- Theme toggle (light/dark) and responsive layout.
- Static — works locally (open `index.html`) or via simple static server.

---

## Tech / Libraries
- HTML / CSS / JavaScript (Vanilla)
- [Chart.js] for charts
- [wordcloud2.js] for word cloud
- [html2canvas] + [jsPDF] for PDF export
- Font Awesome for icons
- All libraries included via CDN in `index.html`

---

## Expected WhatsApp file format
Exported WhatsApp chats usually look like:
