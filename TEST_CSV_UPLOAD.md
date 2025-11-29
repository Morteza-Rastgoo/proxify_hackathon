# Testing CSV Upload Direct to API

## Prerequisites
1. API backend running on port 3030
2. Frontend running on port 51732
3. Couchbase running and configured
4. Sample CSV file available

## Test Steps

### 1. Verify API is Running
```bash
curl http://localhost:3030/health
```
Expected: Health check response with status "healthy"

### 2. Verify CORS Configuration
The API has CORS enabled with:
- `allow_origins: ["*"]` - Accepts requests from any origin
- `allow_methods: ["*"]` - Accepts all HTTP methods
- `allow_headers: ["*"]` - Accepts all headers

This means the frontend at `http://localhost:51732` can make direct requests to the API.

### 3. Test CSV Upload via Frontend UI

1. Open browser to `http://localhost:51732/dashboard`
2. Click the file input field
3. Select a CSV file (e.g., `modules/api/tests/data/Cillers Cost Log - Costs.csv`)
4. Click "Seed from CSV" button
5. Monitor the browser's Network tab (F12 → Network)

**Expected Network Request:**
- URL: `http://localhost:3030/costs/upload` (NOT `/api/costs/upload`)
- Method: POST
- Content-Type: multipart/form-data
- Status: 200 OK

### 4. Verify Data in Couchbase

After successful upload, the data should be visible:
1. Dashboard should refresh automatically
2. Cost data should appear in the table
3. Charts should populate with new data

### 5. Test CSV Upload via cURL (Alternative)

```bash
curl -X POST http://localhost:3030/costs/upload \
  -F "file=@modules/api/tests/data/Cillers Cost Log - Costs.csv"
```

Expected Response:
```json
{
  "message": "Seeded X transactions"
}
```

## Network Flow Verification

Open browser DevTools (F12) → Network tab:

**Before Fix (using proxy):**
```
Request URL: http://localhost:51732/api/costs/upload
↓ (proxied by Vite)
Actual URL: http://localhost:3030/costs/upload
```

**After Fix (direct):**
```
Request URL: http://localhost:3030/costs/upload
(No proxy involved)
```

## Troubleshooting

### CORS Error
If you see a CORS error in the browser console:
- Check that the API is running
- Verify CORS middleware in `modules/api/src/backend/main.py`
- The API should have `allow_origins=["*"]`

### Connection Refused
If you see "Connection refused":
- Verify API is running on port 3030
- Check `VITE_API_BASE_URL` environment variable
- Ensure no firewall is blocking the connection

### File Not Uploading
If the upload fails:
- Check browser console for errors
- Verify the CSV file format is correct
- Check API logs for processing errors
- Ensure Couchbase is running and accessible

## Success Indicators

✅ Browser Network tab shows request to `http://localhost:3030/costs/upload`
✅ No `/api` prefix in the upload request URL
✅ Response status is 200 OK
✅ Alert shows "File uploaded and data seeded successfully!"
✅ Dashboard refreshes and shows new data
✅ No CORS errors in browser console
✅ File data appears in Couchbase
