# What ATH Monitor Can Do

A plain-English tour of every feature in the system — what it does, who uses
it, and whether it is ready to use today.

No technical knowledge needed. If you want the engineering detail, see
[`README.md`](README.md); if you want to know what is being built next, see
[`BACKLOG.md`](BACKLOG.md).

---

## How to read this

| Mark | Meaning |
|---|---|
| ✅ | **Ready.** Works today, nothing to do. |
| ⚙️ | **Ready, but needs setting up first.** Someone has to configure or fill something in. |
| ⚠️ | **Partly working.** The screen exists but will be empty or incomplete — usually because the desktop app doesn't collect that yet. |
| 🚫 | **Turned off.** Deliberately hidden. Can be switched back on if wanted. |

---

## In one sentence

Employees install a small desktop app and press **Start** when they begin work.
It records how long they worked, takes occasional screenshots, and notes which
programs they used. Managers see all of it on a website.

---

## The desktop app (what employees use)

A small window that sits in the system tray. This is the only thing employees
have to interact with.

| Feature | Status | What it means |
|---|---|---|
| Sign in | ✅ | Employees use the same email and password as the website. |
| Start / stop timer | ✅ | Nothing is recorded until they press Start. Like Hubstaff. |
| Keeps running in the background | ✅ | Closing the window doesn't stop the timer — it hides to the tray. |
| Screenshots | ✅ | About 9 an hour, roughly one every seven minutes, at random moments. Every monitor is captured. |
| Which program is being used | ✅ | Records the program and window title, so "Excel — Q3 Forecast.xlsx" rather than just "Excel". |
| Idle time | ✅ | If someone stops for **5 minutes or more**, that whole break is removed from their day. Shorter pauses still count as work — see below. |
| Second-screen activity | ✅ | If something is playing on another monitor while they work, it is recorded as a note for managers. |
| Survives losing internet | ✅ | If the connection drops, nothing is lost. It's saved and sent when the connection returns. |
| Starts automatically at login | ⚠️ | Not yet — employees have to open it themselves each morning. |
| Updates itself | ⚠️ | Not yet — new versions have to be sent out manually. |

### How idle time is judged

This trips people up, so it's worth being precise. The rule is about
**unbroken** pauses, not the total across a day:

- Stop for **4 minutes**, then move the mouse → **nothing is deducted.** The
  whole four minutes counts as work.
- Stop for **7 minutes** → **all seven** are deducted, not just the two past
  the limit.

Short pauses are just how people work — reading, thinking, talking to a
colleague — so charging them as idle would under-report real effort. Five
minutes is the default and can be changed.

---

## What employees see on the website

| Feature | Status | What it means |
|---|---|---|
| Their own dashboard | ✅ | Hours worked, activity level, their own screenshots. |
| Request missed time | ✅ | If they forgot to start the timer, they can ask a manager to add the hours. |
| Sign up for an account | ✅ | Anyone can register, but they can't do anything until an admin admits them. |

---

## What managers and admins see

### Overview

| Feature | Status | What it means |
|---|---|---|
| Dashboard | ✅ | Today at a glance: who's working, who's idle, who's offline, total hours, most and least productive people. |
| Employee comparison | ✅ | Put two or more people side by side. |
| Employee insights | ✅ | Longer-term patterns per person. |
| Timeline | ✅ | An hour-by-hour strip of someone's day. |

### Managing people

| Feature | Status | What it means |
|---|---|---|
| Employee list and profiles | ✅ | Everyone's details, hours, screenshots and history in one place. |
| Pending signups | ✅ | People who registered but haven't been let in yet. Admit several at once, assigning department, location and role. |
| Organisation chart | ✅ | Who reports to whom, drawn as a tree. |
| Departments and locations | ✅ | Group people however the business is organised. |
| Roles and permissions | ✅ | Control who can see what. |
| Shifts | ✅ | Set working patterns, including multiple shifts. |
| Employee notifications | ✅ | Send messages that appear in the app. |

### Time and attendance

| Feature | Status | What it means |
|---|---|---|
| Timesheets | ✅ | Hours per person per day, exportable. |
| Attendance | ✅ | Who was in, who wasn't. |
| Time claims | ✅ | Employees request forgotten time; managers approve or reject. |

### Productivity

| Feature | Status | What it means |
|---|---|---|
| Classify apps and websites | ✅ | Mark anything Productive, Unproductive or Neutral — and differently per department if needed. |
| Add things before they appear | ✅ | You can enter Excel or netflix.com in advance, rather than waiting for someone to use them. **Worth doing before rollout** — see the warning below. |
| Bulk import from a spreadsheet | ✅ | Upload a list rather than typing them one at a time. |
| The list fills itself in | ✅ | Every program and website anyone uses is added automatically as "Neutral", waiting to be classified. |
| Productivity report | ⚙️ | Works, but shows 0% until things are classified. |
| Web and app usage report | ✅ | Which programs and sites took the most time. |
| Scheduled email reports | ⚙️ | Reports emailed automatically — needs email settings configured. |
| Report downloads | ✅ | Export to Excel or PDF. |

> ### ⚠️ Classify your apps *before* people start
>
> Marking something Productive only affects time recorded **from that moment
> onwards**. It does not go back and re-score days already recorded.
>
> So if employees start on Monday and Excel is classified on Friday, Monday to
> Thursday are stuck as "Neutral" forever. Spend an hour beforehand listing the
> tools your team actually uses.

### Screenshots and monitoring

| Feature | Status | What it means |
|---|---|---|
| Screenshot gallery | ⚙️ | Browse screenshots by person, date and hour. Needs storage configured first. |
| Screenshot logs | ✅ | A searchable, exportable list. |
| Second Screen Activity | ✅ | What was showing on other monitors while someone worked. Recorded as a note, **not** counted as time — see below. |
| Live screen viewing | ⚠️ | The screen exists but shows nothing: our desktop app doesn't stream live video. |
| Screen recording | ⚠️ | Same — not collected by our app. |
| Webcam capture | ⚠️ | Same — not collected by our app. |

> ### How the second-monitor case is handled
>
> Working time is always credited to the window someone is actually typing in.
> If they work in Excel on one screen while a film plays on another, all that
> time still counts as Excel — because two windows can't both own the same
> minute, and pretending otherwise would make the productivity figures
> meaningless.
>
> Instead, the film is recorded separately as **evidence**: "Chrome was on
> display 2 for about 42 minutes without being worked in." Managers can see it
> and judge for themselves.
>
> This only applies to people with more than one monitor. On a single screen
> nothing is reported, because there's no reliable way to know whether a window
> behind another one is actually visible.

### Security and data loss prevention

| Feature | Status | What it means |
|---|---|---|
| USB device detection | ⚠️ | Screen works; our desktop app doesn't detect USB devices yet. |
| Clipboard logs | ⚠️ | Same — not collected yet. |
| Email activity logs | ⚠️ | Same — not collected yet. |
| Print logs | 🚫 | Turned off. |
| System activity log | 🚫 | Turned off. |
| Alerts and alert policies | ✅ | Rules that flag behaviour worth looking at. |
| IP allow-listing | ✅ | Restrict access to known networks. |

### Field workforce (mobile)

| Feature | Status | What it means |
|---|---|---|
| Task and project assignment | ✅ | Assign work to people. |
| Task details | ✅ | Track progress. |
| Clients | ✅ | Client records against tasks. |
| GPS location tracking | 🚫 | Turned off — not wanted for now. |

### Settings

| Feature | Status | What it means |
|---|---|---|
| Monitoring controls | ✅ | Screenshot frequency, idle limit, what is and isn't tracked — per organisation or per person. |
| Storage settings | ⚙️ | Where screenshots are kept, and how long. Currently set to delete after **40 days** to control cost. |
| Account settings | ✅ | Your own profile and password. |
| Language | ✅ | English, Spanish, French, Portuguese, Indonesian and Arabic. |

---

## Things worth knowing before rollout

**People must be told they're being monitored.** In many places this is a legal
requirement, not a courtesy. Worth confirming with whoever handles HR or legal
before anyone is switched on.

**Keystroke recording is deliberately not included and never will be.** It
would capture passwords and private messages, it triggers antivirus software,
and it carries real legal risk. Productive-time reporting doesn't need it.

**Screenshots capture whole screens.** If someone leaves personal messages open
on a second monitor, that will be captured. If that's a concern, the frequency
can be lowered or capture limited to the main screen.

**Storage grows with monitors, not just people.** Someone with two screens
produces twice the screenshots.

---

## Not available yet

These are known gaps, listed in [`BACKLOG.md`](BACKLOG.md) with estimates:

- **Nothing is hosted yet.** Everything above runs on a test machine. Putting it
  on a real server is roughly a day's work and is the only thing standing
  between here and a live pilot.
- **Website addresses.** The system records "Chrome — Jira" from the window
  title, not the actual link. Getting real URLs needs a browser add-on.
- **Typing and click counts.** Activity is measured as active-versus-idle each
  second, which is enough for a percentage but can't tell typing from clicking.
- **Automatic updates and start-on-login** for the desktop app.
- **Alerts for second-screen activity** — the information is recorded, but
  nobody is notified; someone has to open the report.
