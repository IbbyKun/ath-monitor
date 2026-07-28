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
| ⚠️ | **Not there yet.** Planned, but not built. |
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
| Real Time Track | ✅ | A live-updating list of who is working right now, what they are in, and for how long. Refreshes on its own — no live video, just current status. |
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
| Per-person monitoring settings | ✅ | Override the organisation's tracking rules for one employee or group — screenshot frequency, idle limit, what is tracked at all. Useful for a role that shouldn't be screenshotted. |

### Time and attendance

| Feature | Status | What it means |
|---|---|---|
| Timesheets | ✅ | Hours per person per day, exportable. |
| Attendance and punctuality | ⚙️ | A month-at-a-glance grid marking each day Present, Absent, Half-day, **Late**, Overtime or Early-logout — with the minutes. Exports to Excel. Needs shifts set up first. |
| Shifts with a lateness rule | ⚙️ | Per-day start and end times, a grace period before "late" counts (10 min by default), half-day threshold, overtime threshold and an early-logout allowance. |
| Time claims | ✅ | Employees request forgotten time; managers approve or reject. |

> ### Punctuality: what counts as "checking in"
>
> Someone's check-in time is **when they press Start on the desktop app**. The
> system compares that against their shift's start time, allows the grace
> period, and marks the day `L` with the number of minutes if they are past it.
> The monthly grid then reads like `L/P` — late, but present.
>
> Nothing is recorded until shifts are configured and people are assigned to
> one. Until then everyone is treated as having no fixed hours.
>
> ### How the required daily hours are set
>
> **The shift's start and end times are the day's length.** 09:00–18:00 means a
> nine-hour day, and that is what attendance and overtime are measured against.
> There is no separate "hours per day" box.
>
> Three other fields adjust what that day has to contain:
>
> | Field | What it does |
> |---|---|
> | **Over Time** | How far *past* the shift end before overtime is credited. A threshold, not a target — set 00:30 and someone leaving 20 minutes late gets nothing, 45 minutes late is recorded as 45 minutes of overtime. Defaults to 1 hour if left blank. |
> | **Half Day** | Hours below which the day is marked `H` instead of `P`. |
> | **Full-Day / Half-Day Productive Time** | An extra requirement: even with the hours present, the day only counts as full unless *productive* time clears this. Leave blank to judge on attendance alone. |
>
> ⚠️ **Careful with Half Day.** The full-day requirement is calculated as
> **double** the half-day figure — not from the shift length. Set Half Day to 4
> hours on a 9-hour shift and a "full day" quietly becomes 8 hours, not 9.
> Leave it blank and it follows the shift correctly.
>
> Separately, **Settings → Monitoring Control** has its own productive-hours
> target (8 hours by default) that drives the dashboard. It is independent of
> the shift's Full-Day Productive Time — if you want one number, set both.
>
> **One thing to decide before using this for anything that affects people:**
> the app does not yet start automatically when a laptop boots. Someone who
> starts work on time but opens the app ten minutes later is recorded as ten
> minutes late. If punctuality is going to be reported on, turn on auto-start
> first — it is a known gap, listed in the backlog.

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
| Per-person history tabs | ✅ | On any employee's profile: **Web History** (sites visited), **App History** (programs used), plus their productivity, timesheets and screenshots. |
| Second Screen Activity | ✅ | What was showing on other monitors while someone worked. Recorded as a note, **not** counted as time — see below. |

Live screen viewing, screen recording and webcam capture have been **removed
from the menus**. They were part of the original product but nothing collects
that data, so the pages could only ever be empty. The code is still there and
commented, should they ever be wanted.

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
| USB storage detection | ✅ | Records when a USB drive is plugged in or pulled out during working time. **Storage only** — see below. |
| Alerts and alert policies | ✅ | Rules that flag behaviour worth looking at. |
| IP allow-listing | ✅ | Restrict access to known networks. |

Clipboard logs, email activity logs, print logs and the system activity log
have been **removed from the menus** for the same reason as above: nothing
collects them.

> ### USB detection will not flag your mouse
>
> The obvious way to build this — list USB devices and try to work out which
> are storage — is exactly where false alarms come from. A docking station, a
> webcam with a card slot or a phone on charge all confuse that approach.
>
> So the agent doesn't ask "what USB devices are attached?" It asks the
> computer **"what disks are attached, and which of them came in over USB?"** A
> mouse is never a disk. Neither is a monitor, a headset, a keyboard or a
> webcam. They cannot appear in the answer, whatever they report themselves as,
> so there is no guesswork to get wrong.
>
> Anything already plugged in when someone starts their timer is ignored — it
> wasn't plugged in *during* work. Only genuine plug and unplug events while
> the timer is running are recorded.

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
| Localization | ✅ | The organisation's **timezone** — which decides what "today" means for every report, and the hours screenshots are filed under. Language is here too, currently English only. |

---

## Managers get a smaller version of the same thing

There are three levels of access, not two. **Managers** (and team leads) sign in
to the same portal as admins but see a reduced menu — their own team's
dashboards, attendance, timesheets, insights, time claims, reports, USB
detection and the settings screens, without the organisation-wide
administration.

Exactly what each role can reach is controlled under **Settings → Roles &
Permissions**, so the split is adjustable rather than fixed.

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
- **Automatic updates and start-on-login** for the desktop app.
- **Alerts for second-screen activity** — the information is recorded, but
  nobody is notified; someone has to open the report.
- **Reseller Dashboard, Reseller Settings and Addon Features** exist and work
  but have no menu entry, because they belong to the original product's
  business model rather than yours. They are reachable only by typing the URL.

### Settled, so not on the list

- **Typing versus clicking.** Both already count fully towards activity — a
  second spent typing and a second spent on the mouse are treated identically,
  so nobody is penalised for how they work. Reporting *which* it was would need
  extra software on each machine for no benefit, so it is not planned.
- **Recording what people type.** Never. It would capture passwords and private
  messages, and it is not needed to measure productive time.
