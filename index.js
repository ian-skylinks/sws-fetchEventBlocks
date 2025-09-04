'use strict';

const Airtable = require('airtable');
const { DateTime } = require('luxon');

const TABLE_NAME     = 'Event Blocks';
const FIELD_DATE     = 'Date';        // Date (with time)
const FIELD_FRAME    = 'Time Frame';  // single select: AM | PM
const FIELD_LOCATION = 'Location';    // single select: Skyroom | Event Tent

const AT = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN });
const base = AT.base(process.env.AIRTABLE_BASE_ID);
const TZ   = process.env.TIMEZONE || 'America/Los_Angeles';

function parseMonth(input) {
  const m = String(input || '').trim();
  const mMatch = /^(\d{4})-(\d{2})$/.exec(m);
  if (!mMatch) return null;
  const year = Number(mMatch[1]);
  const month = Number(mMatch[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function monthStartEnd({ year, month }) {
  const start = DateTime.fromObject({ year, month, day: 1, hour: 0 }, { zone: TZ }).startOf('day');
  const end   = start.plus({ months: 1 });
  return { start, end };
}

module.exports = async function fetchEventBlocks(req, res) {
  try {
    const monthStr = req.query.month;
    const parsed = parseMonth(monthStr);
    if (!parsed) {
      res.status(400).json({ error: 'Missing or invalid month. Use ?month=YYYY-MM' });
      return;
    }
    const { year, month } = parsed;
    const { start, end } = monthStartEnd({ year, month });

    const formula = `
      AND(
        {${FIELD_STATUS}}="Open",
        NOT(IS_BEFORE({${FIELD_DATE}},"${start.toISO()}")),
        IS_BEFORE({${FIELD_DATE}},"${end.toISO()}")
      )
    `.replace(/\s+/g, ' ');

    const records = await base(TABLE_NAME).select({
      fields: [FIELD_DATE, FIELD_FRAME, FIELD_LOCATION],
      filterByFormula: formula,
      pageSize: 100,
    }).all();

    const events = records.map(r => {
      const startJs     = r.get(FIELD_DATE);
      const frameObj    = r.get(FIELD_FRAME);
      const locationObj = r.get(FIELD_LOCATION);
      const frame       = frameObj?.name || '';
      const location    = locationObj?.name || '';

      const startDt = DateTime.fromJSDate(startJs, { zone: TZ });
      const endDt   = frame === 'AM'
        ? startDt.set({ hour: 14, minute: 0, second: 0, millisecond: 0 })
        : startDt.set({ hour: 20, minute: 0, second: 0, millisecond: 0 });

      return {
        id: r.id,
        title: `${frame} at ${location}`,
        start: startDt.toISO(),
        end:   endDt.toISO(),
        allDay: false,
        extendedProps: { frame, location },
      };
    });

    res.set('Cache-Control', 'public, max-age=60');
    res.status(200).json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
};
