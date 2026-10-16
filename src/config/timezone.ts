// Every society is in India, and code that asks for "today" or "now" (setHours, getHours,
// toLocaleDateString, the 3 AM cleanup job) means Indian time. Hosts run on UTC, which put
// "today" 5½ hours off. Imported first in server.ts, before anything creates a Date.
// Code that pins the offset itself (IST_OFFSET_MS + toISOString, '+05:30') is unaffected.
process.env.TZ = process.env.TZ || 'Asia/Kolkata';

export {};
