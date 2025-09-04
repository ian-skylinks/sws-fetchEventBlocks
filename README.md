# sws-fetchEventBlocks

## Endpoint
`GET /fetchEventBlocks?month=YYYY-MM`

## Input
- `month` (required): e.g., `2025-09`

## Output (example)
```json
[
  {"id":"rec123","title":"AM at Skyroom","start":"2025-09-12T10:00:00-07:00","end":"2025-09-12T14:00:00-07:00","allDay":false,"extendedProps":{"frame":"AM","location":"Skyroom"}}
]
