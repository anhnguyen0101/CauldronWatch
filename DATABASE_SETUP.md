# Database Setup for Teammates

## ⚠️ Database File Not in Git

The database file (`data/cauldronwatch.db`) is **NOT** in git because it's too large (107MB > GitHub's 100MB limit).

## ✅ How to Get the Database

### Option 1: Populate from EOG API (Recommended)

Run the populate script to fetch all data:

```bash
python backend/populate_database.py
```

This will:
- Fetch all cauldrons, tickets, historical data from EOG API
- Cache everything in the database
- Take a few minutes (fetches ~570K data points)

### Option 2: Share Database File Directly

If someone already has the database populated:
1. Ask them to share `data/cauldronwatch.db` via:
   - Google Drive / Dropbox
   - Direct file transfer
   - Team chat
2. Place it in the `data/` folder
3. You're ready to go!

## 📊 What's in the Database

After populating, you'll have:
- **12 cauldrons** - All cauldron information
- **570,000+ historical data points** - Time series data
- **149 tickets** - All transport tickets
- **1 market** - Market information
- **5 couriers** - Courier information

## 🔍 View Database

### Using DB Browser for SQLite
1. Download: https://sqlitebrowser.org/
2. Open: `data/cauldronwatch.db`
3. Browse all tables

### Using Command Line
```bash
sqlite3 data/cauldronwatch.db
.tables
SELECT * FROM cauldrons LIMIT 5;
```

### Using Python Script
```bash
python backend/view_database.py
```

## 🚀 Quick Start

1. **Clone the repo**
2. **Install dependencies**: `pip install -r requirements.txt`
3. **Populate database**: `python backend/populate_database.py`
4. **Start server**: `uvicorn backend.api.main:app --reload`
5. **View in DB Browser**: Open `data/cauldronwatch.db`

## 📝 Notes

- Database auto-creates on first server start (but empty)
- Run `populate_database.py` to fill it with data
- Database is in `.gitignore` (won't be committed)
- Each teammate should populate their own database

