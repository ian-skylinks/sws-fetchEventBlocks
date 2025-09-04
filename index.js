'use strict';
const Airtable = require('airtable');
const { DateTime } = require('luxon');

const TABLE_NAME     = 'Event Blocks';
const FIELD_DATE     = 'Date';
const FIELD_FRAME    = 'Time Frame';
const FIELD_STATUS   = 'Status';
const FIELD_LOCATION = 'Location';

const AT = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN });
const base = AT.base(process.env.AIRTABLE_BASE_ID);
const TZ   = process.env.TIMEZONE || 'America/Los_Angeles';

function parseMonth(input) {
  const m = String(input || '').trim();
  const mm = /^(\d{4})-(\d{2})$/.exec(m);
  if (!mm) return null;
  const year = +mm[1], month = +mm[2];
  if (month < 1 || month > 12) return null;
  return { year, month };
}
function monthStartEnd({ year, month }) {
  const start = DateTime.fromObject({ year, month, day: 1 }, { zone: TZ }).startOf('day');
  return { start, end: start.plus({ months: 1 }) }; // [start, end)
}


module.exports.fetchEventBlocks = async (req, res) => {
  try {
    const parsed = parseMonth(req.query.month);
    if (!parsed) return res.status(400).json({ error: 'Use ?month=YYYY-MM' });
    const { start, end } = monthStartEnd(parsed);

    const filterByFormula = `
      AND(
        {${FIELD_STATUS}}="Open",
        NOT(IS_BEFORE({${FIELD_DATE}},"${start.toISO()}")),
        IS_BEFORE({${FIELD_DATE}},"${end.toISO()}")
      )
    `.replace(/\s+/g, ' ');

    const records = await base(TABLE_NAME).select({
      fields: [FIELD_DATE, FIELD_FRAME, FIELD_LOCATION],
      filterByFormula,
      pageSize: 100
    }).all();

    const events = records.map(r => {
      const startJs  = r.get(FIELD_DATE);
      const frame    = r.get(FIELD_FRAME)?.name || '';
      const location = r.get(FIELD_LOCATION)?.name || '';
      const s = DateTime.fromJSDate(startJs, { zone: TZ });
      const e = frame === 'AM'
        ? s.set({ hour: 14, minute: 0, second: 0, millisecond: 0 })
        : s.set({ hour: 20, minute: 0, second: 0, millisecond: 0 });
      return {
        id: r.id,
        title: `${frame} at ${location}`,
        start: s.toISO(),
        end:   e.toISO(),
        allDay: false,
        extendedProps: { frame, location }
      };
    });

    res.set('Cache-Control', 'public, max-age=60');
    res.status(200).json(events);
  } catch (err) {
    console.error('fetchEventBlocks error', err);
    res.status(500).json({ error: 'Internal error' });
  }
};

