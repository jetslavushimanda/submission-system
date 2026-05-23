# JETS Lavushimanda District — Submission System Setup Guide

**For: District JETS Executive Committee (DEC)**
**Edition:** 2024–2026
**District:** Lavushimanda, Muchinga Region, Zambia
**Ministry:** Ministry of Education / National Science Centre
**Theme:** "Promoting Innovation, Engineering and Entrepreneurship: Accelerating STEM Growth and Development"

---

## SECTION 1 — WHAT YOU NEED

Before you begin, make sure you have all of the following:

| Item | Details |
|------|---------|
| Google Account | A Gmail address (e.g. yourname@gmail.com) |
| Internet Connection | Stable connection throughout the setup |
| Device | Phone or laptop — laptop is recommended for setup |
| Images | `coat-of-arms.png` and `jets-logo.png` files ready |

---

## SECTION 2 — GOOGLE SHEET SETUP

### Step 1: Create the spreadsheet

1. Go to [sheets.google.com](https://sheets.google.com) and sign in with your Gmail.
2. Click **+ Blank** to create a new spreadsheet.
3. Click on the title at the top (where it says "Untitled spreadsheet") and rename it to:

```
JETS Lavushimanda 2024-2026
```

### Step 2: Create the 4 tabs

At the bottom of the screen you will see a tab called **Sheet1**. You need to create 4 tabs with these exact names and columns.

**Tab 1 — `Registered Schools`**

> This is the registration list that controls who can log in. The column order must be exact.

| Column A | Column B | Column C | Column D | Column E | Column F | Column G |
|----------|----------|----------|----------|----------|----------|----------|
| Zone | School Name | School Type | Organiser Name | Phone | Gmail | Status |

- **Zone** — one of: `Mpumba`, `Chiundaponde`, `Lukulu`, `Kalonje`, `Mwelushi`
- **School Type** — one of: `Primary School`, `Open Centre School`, `Secondary School`, `Private School`, `Community School`
- **Gmail** — the full Gmail address of the School JETS Organiser (this is what they log in with)
- **Status** — type `Active` to allow login, `Inactive` to block it

**Tab 2 — `School Submissions`**

> Filled automatically by the system. Do not edit.

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q | R | S |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Timestamp | Ref# | Zone | School | School Type | Organiser | Phone | Participant Type | Level | Full Name | Age | Sex | Grade | Category | Sub-Skill | Innovation Title | Supervising Teacher/Mentor | Report Drive Link | Submitted By |

**Tab 3 — `Zone Submissions`**

> Filled automatically by the system. Do not edit.

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q | R | S |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Timestamp | Ref# | Zone | Zonal Coordinator | Phone | Participant School | School Type | Participant Type | Level | Full Name | Age | Sex | Grade | Category | Sub-Skill | Innovation Title | Supervising Teacher/Mentor | Report Drive Link | Submitted By |

**Tab 4 — `District Dashboard`**

> Updated automatically after every submission. Read-only summary for the District JETS Organiser.

| Column A | Column B | Column C | Column D | Column E |
|----------|----------|----------|----------|----------|
| Zone | School Submissions | Zone Submissions | Total | Last Updated |

> **How to add tabs:** Right-click an existing tab at the bottom, select **Insert sheet**, and type the exact name shown above.

### Step 3: Copy your Sheet ID

Look at the URL in your browser. It will look like this:

```
https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit
```

The Sheet ID is the long string of letters and numbers **between `/d/` and `/edit`**. Copy it and save it somewhere — you will need it later.

```
Example Sheet ID: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
```

---

## SECTION 3 — GOOGLE DRIVE SETUP

### Step 1: Create the main folder

1. Go to [drive.google.com](https://drive.google.com).
2. Click **+ New > Folder**.
3. Name the folder:

```
JETS Lavushimanda 2024-2026
```

### Step 2: Create subfolders inside the main folder

Open the folder you just created, then create two subfolders inside it:

```
School Submissions
Zone Submissions
```

### Step 3: Create zone folders inside Zone Submissions

Open the **Zone Submissions** folder, then create these 5 folders inside it:

```
Mpumba
Chiundaponde
Lukulu
Kalonje
Mwelushi
```

### Step 4: Copy your Drive Folder ID

Click on the main **JETS Lavushimanda 2024-2026** folder to open it. Look at the URL:

```
https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
```

The Folder ID is the long string at the end after `/folders/`. Copy it and save it.

```
Example Folder ID: 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
```

---

## SECTION 4 — APPS SCRIPT DEPLOYMENT

### Step 1: Open Apps Script

1. Open your Google Sheet (**JETS Lavushimanda 2024-2026**).
2. In the top menu, click **Extensions > Apps Script**.
3. A new browser tab will open with the Apps Script editor.

### Step 2: Create the 4 script files

You need to create 4 files. By default, one file called `Code.gs` already exists.

To create additional files: click the **+** icon next to **Files** in the left panel and select **Script**.

Create these 4 files with these exact names:

```
Code.gs
auth.gs
school.gs
zone.gs
```

### Step 3: Paste the script content

Open each file and paste in the corresponding script content from the `apps-script/` folder provided with this system. Make sure you paste the correct content into each file — do not mix them up.

| File | Source |
|------|--------|
| `Code.gs` | `apps-script/Code.gs` |
| `auth.gs` | `apps-script/auth.gs` |
| `school.gs` | `apps-script/school.gs` |
| `zone.gs` | `apps-script/zone.gs` |

### Step 4: Fill in your IDs in Code.gs

Open `Code.gs` and find these two lines near the top:

```javascript
const SHEET_ID = "";
const DRIVE_FOLDER_ID = "";
```

Paste your values between the quotes:

```javascript
const SHEET_ID = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms";
const DRIVE_FOLDER_ID = "1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p";
```

Save the file by pressing **Ctrl + S** (or **Cmd + S** on Mac).

### Step 5: Deploy as a Web App

1. Click the blue **Deploy** button at the top right.
2. Select **New deployment**.
3. Click the gear icon next to **Type** and select **Web app**.
4. Fill in the settings exactly as shown:

| Setting | Value |
|---------|-------|
| Description | JETS Lavushimanda Portal |
| Execute as | **Me** |
| Who has access | **Anyone** |

5. Click **Deploy**.
6. Google will ask you to **authorize** the app. Click **Authorize access**, choose your Gmail account, and click **Allow**.
7. After deployment, you will see a **Web App URL**. It will look like:

```
https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxxxx/exec
```

Copy this URL and save it — you will need it in the next section.

> **Important:** Every time you make changes to the script and redeploy, you get a new URL. You must update the URL in `js/app.js` each time you redeploy.

---

## SECTION 5 — GITHUB PAGES SETUP

### Step 1: Create a GitHub account

1. Go to [github.com](https://github.com).
2. Click **Sign up** and create a free account.
3. Verify your email address.

### Step 2: Create a new repository

1. After signing in, click the **+** icon at the top right and select **New repository**.
2. Fill in the details:

| Setting | Value |
|---------|-------|
| Repository name | `submission-system` |
| Visibility | **Public** |
| Initialize with README | Leave unchecked |

3. Click **Create repository**.

### Step 3: Upload the frontend files

1. On your new repository page, click **Add file > Upload files**.
2. Upload all of the following:

```
index.html
css/        (the entire folder)
js/         (the entire folder)
assets/     (the entire folder — including coat-of-arms.png and jets-logo.png)
```

3. Scroll down, add a commit message like `Initial upload`, and click **Commit changes**.

### Step 4: Enable GitHub Pages

1. Click the **Settings** tab at the top of your repository.
2. In the left sidebar, scroll down and click **Pages**.
3. Under **Source**, select:
   - Branch: **main**
   - Folder: **/ (root)**
4. Click **Save**.
5. After a minute, GitHub will show you your live link:

```
https://jetslavushimanda.github.io/submission-system
```

### Step 5: Paste your Apps Script URL into app.js

1. In your repository, navigate to `js/app.js`.
2. Click the **pencil icon** (Edit this file) at the top right.
3. Find this line near the top:

```javascript
const APPS_SCRIPT_URL = "";
```

4. Paste your Web App URL between the quotes:

```javascript
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxxxx/exec";
```

5. Scroll down and click **Commit changes**.

### Step 6: Share the link

Your portal is now live. Share the GitHub Pages link on WhatsApp:

```
https://jetslavushimanda.github.io/submission-system
```

This single link works for all schools and zones in Lavushimanda District.

---

## SECTION 6 — REGISTERING SCHOOLS (DEC ONLY)

Only the DEC registers schools. Schools cannot register themselves.

### How to register a school

1. Collect the Gmail address of each School JETS Organiser via WhatsApp.
   - The Gmail must be correct, including spelling — it is used to verify who is submitting.
2. Open your Google Sheet and go to the **Schools** tab (Tab 1).
3. Enter each school on its own row using the Tab 1 column order:

| Zone | School Name | School Type | Organiser Name | Phone | Gmail | Status |
|------|-------------|-------------|----------------|-------|-------|--------|
| Mpumba | Lavushimanda Basic School | Primary School | Mr. Banda | 0971234567 | banda@gmail.com | Active |
| Chiundaponde | Chiundaponde Secondary | Secondary School | Mrs. Phiri | 0962345678 | phiri@gmail.com | Active |

4. Make sure the **Status** column is set to `Active` for each school.

> Schools with Status set to anything other than `Active` will not be able to submit.

### Zones reference

| Zone | Centre |
|------|--------|
| Mpumba | Kapengwe |
| Chiundaponde | Chiundaponde |
| Lukulu | Lukulu |
| Kalonje | Kalonje |
| Mwelushi | Muwele |

---

## SECTION 7 — SHARING THE PORTAL

Once setup is complete, share the GitHub Pages link on your DEC WhatsApp group and with all Zone Chairpersons.

**Template message for WhatsApp:**

```
Good morning everyone.

The JETS Lavushimanda 2024-2026 submission portal is now live.

School Organisers: use this link to submit your documents:
https://jetslavushimanda.github.io/submission-system

You will need your registered Gmail to log in.
Contact the DEC if your school is not found.

Zone Chairpersons: use the same link to submit zone documents.
```

---

## SECTION 8 — TROUBLESHOOTING

### Form not loading

**Symptom:** The website shows a blank page or a "404" error.

**Steps to fix:**
1. Go to your GitHub repository **Settings > Pages**.
2. Confirm that GitHub Pages is enabled and the source is set to the **main** branch.
3. Wait 2–3 minutes after enabling, then reload the page.
4. Make sure the repository visibility is set to **Public**, not Private.

---

### Submission failing or spinning forever

**Symptom:** The form submits but nothing happens, or an error message appears.

**Steps to fix:**
1. Open `js/app.js` in your GitHub repository.
2. Check that `APPS_SCRIPT_URL` contains the correct Web App URL with no extra spaces.
3. Go to Apps Script and click **Deploy > Manage deployments**.
4. Confirm the deployment is active and **Who has access** is set to **Anyone**.
5. If still failing, create a **New Deployment**, copy the new URL, and update `APPS_SCRIPT_URL` in `js/app.js`.

---

### "School not found" or "Registration not found"

**Symptom:** A school organiser enters their Gmail and the system says they are not registered.

**Steps to fix:**
1. Open the Google Sheet and go to the **Schools** tab.
2. Find the school's row and check the **OrganizerEmail** column.
3. Common causes:
   - Extra space before or after the email address
   - Wrong Gmail entered (e.g. a typo or wrong account)
   - **Status** column is `Inactive` instead of `Active`
4. Correct the entry and ask the organiser to try again.

---

### File upload failing

**Symptom:** The file upload shows an error or does not complete.

**Steps to fix:**
1. Confirm the file is under **10MB**.
2. Confirm the file format is one of: `.doc`, `.docx`, or `.pdf`.
3. Ask the organiser to reduce the file size (compress or export as PDF) if it is too large.
4. Check that the internet connection is stable before trying again.

---

### CORS error

**Symptom:** Submission fails and the browser shows a CORS error (visible in browser developer tools).

**Steps to fix:**
1. Go to Apps Script and click **Deploy > New deployment**.
2. Set **Execute as: Me** and **Who has access: Anyone**.
3. Copy the new Web App URL.
4. Open `js/app.js` on GitHub and update `APPS_SCRIPT_URL` with the new URL.
5. Commit the change and wait 1–2 minutes before testing again.

---

## QUICK REFERENCE

| Item | Where to find it |
|------|-----------------|
| Sheet ID | Google Sheets URL — the long string between `/d/` and `/edit` |
| Drive Folder ID | Google Drive folder URL — the string after `/folders/` |
| Apps Script Web App URL | Apps Script > Deploy > Manage deployments |
| GitHub Pages URL | GitHub repo > Settings > Pages |

---

## ROLES SUMMARY

| Role | Responsibility |
|------|---------------|
| District JETS Executive Committee (DEC) | Registers schools in Tab 1; manages the system |
| School JETS Organiser | Submits school documents via the green form |
| Zonal JETS Coordinator | Submits zone documents via the blue form |
| District JETS Organiser | Views the district dashboard (read-only, Tab 4) |

---

## CONTACT

For technical support, contact your system administrator or the person who built this system.

> This system was set up for the JETS Lavushimanda District 2024–2026 cycle.
