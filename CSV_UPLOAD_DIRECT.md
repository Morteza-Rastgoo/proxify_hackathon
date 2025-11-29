# CSV Upload - Direct to API

## Problem
Previously, the CSV file upload was using the frontend's Vite proxy (`/api/costs/upload`), which means:
- The CSV file data was being proxied through the frontend dev server
- This adds unnecessary overhead and latency
- The frontend server acts as a middleman, forwarding the file to the API

## Solution
The CSV upload now sends the file **directly to the API backend** at `http://localhost:3030/costs/upload`, bypassing the frontend proxy entirely.

## Changes Made

### 1. Frontend Code Update (`modules/frontend/app/routes/dashboard.tsx`)
```typescript
// OLD - Using frontend proxy
const response = await fetch("/api/costs/upload", {
  method: "POST",
  body: formData,
});

// NEW - Direct to API backend
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3030";
const response = await fetch(`${apiBaseUrl}/costs/upload`, {
  method: "POST",
  body: formData,
});
```

### 2. Configuration
The API base URL is configured in `modules/frontend/polytope.yml`:
- Parameter: `api-base-url` (default: `http://localhost:3030`)
- Environment variable: `VITE_API_BASE_URL`
- This allows the frontend to know where the API is running

## How It Works

1. **User selects CSV file** in the dashboard
2. **User clicks "Seed from CSV"** button
3. **Frontend sends file directly** to `http://localhost:3030/costs/upload`
4. **API receives and processes** the CSV file
5. **API stores data** in Couchbase database
6. **Frontend refreshes data** to display the newly seeded costs

## Benefits

✅ **No proxy overhead** - File goes directly to the API
✅ **Faster uploads** - Eliminates the middleman
✅ **More efficient** - No unnecessary data copying
✅ **Better architecture** - Clear separation of concerns
✅ **Configurable** - API URL can be changed via environment variable

## Testing

To test the direct upload:
1. Start the API backend: The API should be running on port 3030
2. Start the frontend: The frontend should be running on port 51732
3. Navigate to the dashboard
4. Select a CSV file
5. Click "Seed from CSV"
6. The file will be sent directly to `http://localhost:3030/costs/upload`
7. Data will be stored in Couchbase and displayed on the dashboard

## Network Flow

```
┌──────────┐                    ┌──────────┐
│          │  CSV File (Direct) │          │
│ Frontend ├───────────────────►│   API    │
│  :51732  │                    │  :3030   │
│          │◄───────────────────┤          │
└──────────┘  Success Response  └────┬─────┘
                                     │
                                     ▼
                               ┌──────────┐
                               │Couchbase │
                               │          │
                               └──────────┘
```

## Notes

- The frontend still uses the proxy (`/api`) for regular GET requests to fetch cost data
- Only the CSV upload bypasses the proxy for efficiency
- The API URL is configurable via `VITE_API_BASE_URL` environment variable
- Default API URL: `http://localhost:3030`
