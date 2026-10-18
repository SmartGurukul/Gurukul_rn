"""Builds the smartgurukul.org marketing site into ../docs (served by GitHub Pages from main:/docs).

Each file in pages/ starts with a JSON meta block in an HTML comment, followed by the page body:

    <!--meta {"path": "ai-for-schools.html", "title": "...", "description": "...", ...} -->
    <section>...</section>

This script wraps every body in the shared <head> (title, description, canonical, Open Graph,
hreflang, JSON-LD), header and footer, then writes sitemap.xml, llms.txt and the redirect stubs, and
checks the result. Run it after editing anything here:

    python website/build.py        (no third-party dependencies; exits 1 when a check FAILs)

Meta keys:
- path, title, description: required.
- crumb: the breadcrumb name (every page except the home pages and 404).
- lang: "hi" for Hindi pages. alternate: the other-language version of this page.
  hreflang: [en_path, hi_path] for a page that has a Hindi pair (written to the head and sitemap).
- og_title, og_image_alt: social-card overrides.
- og_eyebrow, og_headline: the page's own Open Graph card (assets/og/<path>.png, drawn by og_images.py).
  A page without og_headline shares the default card, assets/og-image.png. The card's button follows the
  page's cta_label, and a service page's card leaves off the app tagline (see og_card_text).
- has_form: the page holds the demo form. cta_href / cta_label: header button override.
- noindex: keep out of search, the sitemap and llms.txt.
- software: false drops the SoftwareApplication node (privacy, 404, share).
- service: true adds the Service node (website-services). llms: "optional" lists the page under
  "## Optional" in llms.txt. priority: the sitemap priority.

Every indexable product page (software pages without a form) gets the "Try it free for a month" demo
band before the footer, unless its body already has a .cta-band. On Hindi pages, links to English
pages get hreflang="en".

App labels quoted in the copy go in <span class="ui">…</span>; the build checks each one against the app's
own strings (src/i18n/locales/hi.json on Hindi pages, en.json on English pages), so a renamed button
fails the build instead of leaving the site pointing at a label that no longer exists.

Social cards: after changing a page's og_eyebrow/og_headline (or adding a page with one), run
    python website/og_images.py    (needs Pillow, uharfbuzz and fonttools)
before this script; the build FAILs when a card is missing or older than its page's meta.

Pages in docs/ that are NOT built here: deck.html (build_deck.py), film.html, onboarding-toolkit.html
(hand-written), robots.txt, site.webmanifest, CNAME, favicon.ico, the IndexNow key file and assets/.
"""
import datetime
import hashlib
import html
import json
import re
import struct
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
OUT = REPO / "docs"
SITE = "https://smartgurukul.org"
BRAND = "Smart Gurukul"
BRAND_HI = "स्मार्ट गुरुकुल"
INSTAGRAM = "https://www.instagram.com/smartgurukul.app"
TODAY = datetime.date.today().isoformat()

# Pages that moved. The build writes a small redirect page at the old path (kept out of the sitemap).
REDIRECTS = {"money-features.html": "school-fee-management.html"}

# One ordered list behind SoftwareApplication.featureList. Only what is live on main today.
FEATURES = [
    "AI helpdesk assistant for staff and students",
    "Academic Helper for teachers and students",
    "AI question paper and quiz generator for teachers",
    "GPS check-in attendance for teachers, with fake-GPS checks and no biometric hardware",
    "Class attendance with absence alerts to parents",
    "Timetable with bell schedule, rooms and substitutions",
    "Fee structures, bills, due-date reminders and PDF receipts",
    "Payroll runs, salary structures and payslips",
    "Expenses, vendors and approvals",
    "Exams, grading scales and PDF report cards",
    "School bus tracking with a driver app and live map for families",
    "Parent app with multi-child access and chat with teachers",
    "One-to-one chat, school notices and events with RSVP, registration forms and polls",
    "Admissions and ID cards with QR codes",
    "XP, daily streaks, weekly leagues and House Wars",
    "Live Battle Room quizzes and 1v1 Arena challenges",
]

ORG = {
    "@type": "Organization",
    "@id": f"{SITE}/#org",
    "name": BRAND,
    "alternateName": ["SmartGurukul", "Smart Gurukul App", BRAND_HI],
    "url": f"{SITE}/",
    "logo": f"{SITE}/assets/brand/icon-512.png",
    "slogan": "Your whole school, connected.",
    "sameAs": [INSTAGRAM],
    "areaServed": {"@type": "Country", "name": "India"},
    "description": "Smart Gurukul makes a school management app with AI and games for Indian K-12 schools, built by an IIT-BHU team.",
    "disambiguatingDescription": "Software company that makes a school app for Indian K-12 schools; not a school.",
    "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "sales",
        "url": f"{SITE}/#demo",
        "areaServed": "IN",
        "availableLanguage": ["en", "hi"],
    },
}
SOFTWARE = {
    "@type": "SoftwareApplication",
    "@id": f"{SITE}/#app",
    "name": BRAND,
    "applicationCategory": "EducationalApplication",
    "applicationSubCategory": "School management software",
    "operatingSystem": "Android",
    "inLanguage": ["en-IN", "hi-IN"],
    "publisher": {"@id": f"{SITE}/#org"},
    "url": f"{SITE}/",
    "image": f"{SITE}/assets/og-image.png",
    "description": (
        "Smart Gurukul connects the whole school in one app. It combines AI (an AI helpdesk, Academic "
        "Helper and a question paper generator), school operations (GPS teacher attendance with no "
        "hardware, fees and receipts, payroll, timetable and substitutions, exams and report cards, "
        "school bus tracking, chat and events) and game-based learning (XP, streaks, leagues, House "
        "Wars, quiz battles) for principals, teachers, students and parents, in English and Hindi."
    ),
    "featureList": FEATURES,
}
WEBSITE = {
    "@type": "WebSite",
    "@id": f"{SITE}/#website",
    "url": f"{SITE}/",
    "name": BRAND,
    "alternateName": ["SmartGurukul", BRAND_HI],
    "publisher": {"@id": f"{SITE}/#org"},
    "inLanguage": ["en-IN", "hi-IN"],
}
SERVICE = {
    "@type": "Service",
    "@id": f"{SITE}/website-services.html#service",
    "serviceType": "School website design and development",
    "provider": {"@id": f"{SITE}/#org"},
    "areaServed": {"@type": "Country", "name": "India"},
    # availableLanguage isn't a Service property; it belongs on the ServiceChannel.
    "availableChannel": {
        "@type": "ServiceChannel",
        "serviceUrl": f"{SITE}/website-services.html",
        "availableLanguage": ["en", "hi"],
    },
}

# Alt text for the default card (assets/og-image.png, drawn by og_images.py: the English lockup, "School
# management app", the tagline and a "Book a free demo" button). Pages with og_headline share their
# own card, whose alt is "Smart Gurukul: <og_headline>" unless og_image_alt overrides it.
OG_IMAGE_ALT = {
    "en": "Smart Gurukul: Your whole school, connected.",
    "hi": "स्मार्ट गुरुकुल: Your whole school, connected.",
}
OG_ALT_PREFIX = {"en": "Smart Gurukul: ", "hi": "स्मार्ट गुरुकुल: "}
OG_DEFAULT = "assets/og-image.png"
# Bump when og_images.py draws the cards differently, so the manifest check asks for a re-run.
OG_VERSION = "2"
OG_MAX_BYTES = 300 * 1024
# The longest og_eyebrow / og_headline the build accepts. og_images.py measures the drawn text and stops on
# anything that doesn't fit; these limits make the build FAIL first in the usual case (a 49-character
# English eyebrow is ~770 px at 28 px, past the 632 px the paper side has room for).
OG_TEXT_MAX = {"og_eyebrow": 36, "og_headline": 50}
# The card's button and the line above it, unless the page says otherwise (see og_card_text).
OG_CTA = {"en": "Book a free demo", "hi": "मुफ़्त डेमो बुक करें"}
OG_TAGLINE = {"en": "AI + School + Games", "hi": "AI + स्कूल + गेम्स"}


def og_card_path(path):
    """The page's own social card: hi/parent-app.html -> assets/og/hi-parent-app.png."""
    return "assets/og/" + path.replace("/", "-").replace(".html", ".png")


def og_card_text(meta):
    """(lang, eyebrow, headline, button, tagline) that the page's card is drawn from.

    The button says what the page's own header button says (cta_label, e.g. "Get a free quote" on
    website-services), so a shared link never promises something the page doesn't offer. The app's tagline
    ("AI + School + Games") is left off a service page (service: true), which sells websites, not the app.
    """
    lang = meta.get("lang", "en")
    button = meta.get("cta_label") or OG_CTA[lang]
    tagline = "" if meta.get("service") else OG_TAGLINE[lang]
    return lang, meta.get("og_eyebrow", ""), meta["og_headline"], button, tagline


def og_hash(meta):
    """What the card was drawn from. og_images.py writes it to assets/og/manifest.json; the build compares."""
    key = "\x1f".join(og_card_text(meta)) + "\x1f" + OG_VERSION
    return hashlib.sha1(key.encode("utf-8")).hexdigest()

# The facts block at the top of docs/llms.txt. Keep it in step with FEATURES and the pages: every line
# must be true on main today (see marketing-sales-pipeline/content/claims.md).
LLMS_FACTS = """# Smart Gurukul

> Smart Gurukul (smartgurukul.org) is a school management app for Indian K-12 schools, made in India by an IIT-BHU team. Tagline: "Your whole school, connected." (Hindi: "पूरा स्कूल, एक ऐप पर जुड़ा।"). One app for principals, teachers, students and parents, in English and Hindi, combining school operations, AI tools and game-based learning. Smart Gurukul is a software company, not a school.

Key facts:
- Brand: Smart Gurukul (स्मार्ट गुरुकुल). Website: https://smartgurukul.org. Contact: the demo request form at https://smartgurukul.org/#demo. Instagram: @smartgurukul.app.
- Who it is for: private CBSE and State Board schools in India of any size. Each school, or each branch of a group, runs as its own account.
- Attendance: class teachers mark student attendance (present, absent, late, half-day); parents with a parent account get an alert when their child is marked absent. Teachers check in by GPS from their own phone; the distance to the school's saved location is checked on the server (100 m radius by default, up to 700 m), and check-ins from phones with a fake-GPS app, Developer options, root/jailbreak or a cloner app are refused. No biometric hardware is needed.
- Timetable: bell schedule (including Saturday), weekly timetables with rooms, one-period date changes (substitute, cancel, extra period), a list of periods that need a substitute based on staff attendance, free teachers per period, and notifications to the affected teachers and students. Admins can make changes by chatting with the AI helpdesk and confirming them. There is no automatic timetable generation.
- Fees: admin-set fee structures per class, bills for a whole section, due dates, concessions, waivers, late fees and corrections, payments recorded by the school (cash, cheque, UPI or bank-transfer reference) with numbered PDF receipts, reversals for mistakes, bounced cheques and refunds, and fee-due reminders to parents. Online fee payment is not available.
- Payroll and expenses: salary structures, monthly payroll runs and payslips in the app (no PF/ESI/TDS); vendors and expenses with approvals (no self-approval); one ledger with a day book and fund summary.
- Exams and report cards: the school's own terms (with dates) and grading bands (a built-in scale until it sets one). Assessments (assignment, quiz, test or exam) per class and subject, with a date, maximum marks and a term, added by the admin, the class teacher or a subject teacher; only they enter marks, with AB (absent, counted as 0), EX (excused, left out) and remarks. A section-wide marks grid and a publish check for missing marks. The admin or the class teacher publishes a term for a section: students and parents are notified on the first publish, that term's marks lock and each report card is kept exactly as published. Only an admin can unpublish, with a reason kept in the activity log. Report cards show subject-wise and overall marks, percentage and grade, term attendance and remarks; a PDF per student (students and parents, once published) or for a whole section, one page per student (admin or class teacher), with a DRAFT watermark before publishing.
- School bus: the driver's phone shares the bus location during a trip (no GPS device); the driver marks boarding and drop-off; families get app and WhatsApp alerts and see the bus live while their child is on it. No route planning.
- Sign-in: a one-time code on WhatsApp to the mobile number on record, or a username and password (stored hashed, never as plain text).
- Parents: the same app. They see attendance, fees and receipts with fee-due reminders, report card, timetable, upcoming tests, ID card and the school bus. Two ways to sign in, both tied to the mobile number on the child's record: a one-time code on WhatsApp signs in on the child's own account (switching between all children on that number), or a parent account (the child's registration number and that number, then a username and password once the school approves it); a parent account covers one child. A parent account adds absence alerts, the list of school announcements and chat with the child's teachers and the school office.
- AI: an AI helpdesk assistant (users ask about their own attendance, fees and timetable; admins also about school-wide figures, through a fixed set of checked, school-scoped lookups rather than free-form database queries); Academic Helper (students are taught the method rather than given answers); and an AI question paper generator for teachers (up to 30 questions, MCQ, true/false, one-word, numeric, short and long answer; shared as a PDF with or without the answer key; MCQs can go to the quiz bank). AI output is a draft for teachers to check.
- Games: one XP score from attendance and quiz wins (Gurukul Arena and Battle Room); streaks, weekly leagues (Bronze up to Gurukul Master), House Wars (each house's XP plus house points that teachers and admins award for effort), live Battle Room quizzes and 1v1 Gurukul Arena. Quiz questions are written by teachers or drafted with AI and reviewed by teachers.
- Communication: one-to-one chat between staff, between staff and students (a student can message any staff member) and between parent accounts and their child's teachers and the school's admins, with photos and PDFs up to 10 MB and a push to the other person. School notices are posted from School Events (a plain announcement, an RSVP, a registration form or a poll) to the whole school (admin), one class-section or a whole grade (admin or class teacher), and pushed to all staff, the students covered and their parent accounts. No group chat, no student-to-student chat, no calling and no SMS.
- Also included: admissions tracked by stage, student and staff ID cards with a QR code, attendance export, activity log.
- Languages: every user can switch the app between English and Hindi. Sign-in, the parent home and child dashboard, fees, report cards, timetable, school bus and ID cards are in Hindi. Some screens, staff ones too, are still English-only, including taking class attendance, teachers' class and student lists, attendance history, the chat list and school events.
- Getting started: free 1-month pilot. The Smart Gurukul team imports the school's student register and trains staff. Pricing is shared after a demo.
- Not available: online fee payment, homework, SMS, group chat, hostel, library, statutory payroll (PF/ESI/TDS), full accounting (trial balance, balance sheet), automatic timetable generation, bus route planning."""

# Header nav: (English page, English label, Hindi label). On Hindi pages a link goes to the Hindi
# version of the page when one exists (see HI_OF), otherwise to the English page.
NAV = [
    ("ai-for-schools.html", "AI", "AI"),
    ("gamified-learning.html", "Games", "गेम्स"),
    ("gps-attendance.html", "Attendance", "हाज़िरी"),
    ("school-fee-management.html", "Fees", "फ़ीस"),
    ("school-timetable-app.html", "Timetable", "टाइमटेबल"),
    ("parent-app.html", "Parent App", "पैरेंट ऐप"),
    ("resources.html", "Lessons", "वीडियो पाठ"),
    ("compare.html", "Compare", "तुलना"),
]
# Hidden from the header between 981 and 1199 px, where the full set of links doesn't fit next to the
# logo, the language switch and the demo button (site.css .nav-wide). Still in the footer and mobile menu.
NAV_WIDE_ONLY = {"gamified-learning.html", "resources.html"}
FOOTER_PRODUCT = [
    ("ai-for-schools.html", "AI for schools", "स्कूलों के लिए AI"),
    ("ai-question-paper-generator.html", "AI question papers", "AI से प्रश्न पत्र"),
    ("gamified-learning.html", "Gamified learning", "गेमिफ़ाइड लर्निंग"),
    ("resources.html", "Video lessons", "वीडियो पाठ"),
    ("gps-attendance.html", "GPS attendance", "GPS हाज़िरी"),
    ("school-timetable-app.html", "Timetable &amp; substitutions", "टाइमटेबल और सब्स्टीट्यूट"),
    ("school-fee-management.html", "Fee management", "फ़ीस और पेरोल"),
    ("school-bus-tracking.html", "School bus tracking", "स्कूल बस ट्रैकिंग"),
    ("parent-app.html", "Parent app", "पैरेंट ऐप"),
    ("report-card-software.html", "Report cards", "रिपोर्ट कार्ड"),
    ("school-communication-app.html", "Chat and notices", "चैट और सूचनाएँ"),
    ("website-services.html", "School websites", "स्कूल वेबसाइट"),
]

MENU_ICON = ('<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
             'stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>')

# Filled in by build() before any page is rendered.
HI_OF = {}          # English page path -> its Hindi version's path
DATES = {}          # page path -> YYYY-MM-DD it last changed
ASSET_VERSION = {}  # "assets/site.css" -> content hash for the ?v= cache-buster


def rel(path, target):
    """Link from the page at `path` to the site-root path `target`, keeping any #fragment.

    Home pages map to their directory URL: index.html -> ./ (../ from hi/), hi/index.html -> hi/
    (./ from inside hi/), so no link ever ends in index.html.
    """
    target, sep, frag = target.partition("#")
    if target == "index.html":
        target = ""
    elif target.endswith("/index.html"):
        target = target[: -len("index.html")]
    if path == "404.html":
        # GitHub Pages serves 404.html for missing URLs at any depth, so its links must be root-absolute.
        url = "/" + target
    else:
        page_dir = path.rsplit("/", 1)[0] + "/" if "/" in path else ""
        if page_dir and target.startswith(page_dir):
            url = target[len(page_dir):]
        else:
            url = "../" * path.count("/") + target
        url = url or "./"
    return url + sep + frag


def localize(target, hi):
    """On a Hindi page, the Hindi version of `target` when one exists (fragment kept)."""
    if not hi:
        return target
    page, sep, frag = target.partition("#")
    return HI_OF.get(page, page) + sep + frag


def page_date(path):
    """The day `path` last changed in git (YYYY-MM-DD). Today when the file is new or has uncommitted
    changes, or git fails (a shallow or missing checkout): harmless, it only means "recently"."""
    try:
        rel_path = Path(path).resolve().relative_to(REPO).as_posix()
        run = lambda *args: subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True,
                                           check=True).stdout.strip()
        if run("status", "--porcelain", "--", rel_path):
            return TODAY
        return run("log", "-1", "--format=%cs", "--", rel_path) or TODAY
    except (OSError, ValueError, subprocess.CalledProcessError):
        return TODAY


def asset_version(rel_path):
    """First 8 hex characters of the SHA-1 of the file's bytes, so the URL changes only when the file does.

    Line endings are normalised to LF first: a Windows checkout (core.autocrlf=true) has CRLF copies of
    site.css/site.js, and hashing those raw would change every page's ?v= although nothing changed.
    """
    data = (OUT / rel_path).read_bytes().replace(b"\r\n", b"\n")
    return hashlib.sha1(data).hexdigest()[:8]


def header(meta):
    p = meta["path"]
    hi = meta.get("lang") == "hi"
    links = []
    for href, en, hin in NAV:
        target = localize(href, hi)
        cur = ' aria-current="page"' if p == target else ""
        wide = ' class="nav-wide"' if href in NAV_WIDE_ONLY else ""
        links.append(f'<li{wide}><a href="{rel(p, target)}"{cur}>{hin if hi else en}</a></li>')
    alt = meta.get("alternate")
    if hi:
        lang_link = f'<a class="lang" href="{rel(p, alt or "index.html")}" hreflang="en" lang="en">English</a>'
    else:
        lang_link = f'<a class="lang" href="{rel(p, alt or "hi/index.html")}" hreflang="hi" lang="hi">हिन्दी</a>'
    home = "hi/index.html" if hi else "index.html"
    demo = "#demo" if meta.get("has_form") else rel(p, home + "#demo")
    # A page whose form isn't the demo form (e.g. website-services.html) points the header button at its own form.
    demo = meta.get("cta_href", demo)
    cta = meta.get("cta_label", 'डेमो बुक करें' if hi else 'Book a free demo')
    return f"""<a class="skip" href="#main">{'मुख्य सामग्री पर जाएं' if hi else 'Skip to content'}</a>
<header class="site-header">
  <div class="wrap nav">
    <a class="brand" href="{rel(p, home)}">
      <img src="{rel(p, 'assets/brand/lockup-hindi.svg' if hi else 'assets/brand/lockup-horizontal.svg')}" width="{144 if hi else 193}" height="40" alt="{BRAND_HI if hi else BRAND}">
    </a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-label="Menu">{MENU_ICON}</button>
    <ul class="nav-links">{''.join(links)}</ul>
    <div class="nav-cta">
      {lang_link}
      <a class="btn btn-primary btn-sm" href="{demo}">{cta}</a>
    </div>
  </div>
</header>"""


def footer(meta):
    p = meta["path"]
    hi = meta.get("lang") == "hi"
    r = lambda t: rel(p, localize(t, hi))
    home = "hi/index.html" if hi else "index.html"
    product = "\n".join(f'          <li><a href="{r(href)}">{hin if hi else en}</a></li>'
                        for href, en, hin in FOOTER_PRODUCT)
    other_lang = ('<a href="{0}" lang="en">English</a>'.format(rel(p, "index.html")) if hi
                  else '<a href="{0}" lang="hi">हिन्दी</a>'.format(rel(p, "hi/index.html")))
    return f"""<footer class="site-footer">
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <a class="brand" href="{rel(p, home)}"><img src="{rel(p, 'assets/brand/lockup-hindi-reversed.svg' if hi else 'assets/brand/lockup-horizontal-reversed.svg')}" width="{137 if hi else 183}" height="38" alt="{BRAND_HI if hi else BRAND}"></a>
        <p class="foot-tagline">{'पूरा स्कूल, एक ऐप पर जुड़ा।' if hi else 'Your whole school, connected.'}</p>
        <p style="max-width:34ch">{'AI, स्कूल और गेम्स — प्रिंसिपल, शिक्षक, छात्र और अभिभावक, सब एक ऐप पर। IIT-BHU की टीम द्वारा बनाया गया।' if hi else 'AI + School + Games for principals, teachers, students and parents. Built by an IIT-BHU team.'}</p>
      </div>
      <div>
        <p class="foot-title">{'प्रोडक्ट' if hi else 'Product'}</p>
        <ul>
{product}
        </ul>
      </div>
      <div>
        <p class="foot-title">{'तुलना करें' if hi else 'Compare'}</p>
        <ul>
          <li><a href="{r('compare.html')}">{'दूसरे सॉफ़्टवेयर से तुलना' if hi else 'vs. other school software'}</a></li>
          <li><a href="{rel(p, home + '#faq')}">{'सवाल-जवाब' if hi else 'FAQ'}</a></li>
          <li>{other_lang}</li>
          <li><a href="{r('onboarding-toolkit.html')}"{' lang="en"' if hi else ''}>School onboarding toolkit</a></li>
        </ul>
      </div>
      <div>
        <p class="foot-title">{'संपर्क' if hi else 'Contact'}</p>
        <ul>
          <li><a href="{INSTAGRAM}" rel="noopener" target="_blank">Instagram @smartgurukul.app</a></li>
          <li><a href="{rel(p, home + '#demo')}">{'मुफ़्त डेमो बुक करें' if hi else 'Book a free demo'}</a></li>
          <li><a href="{r('privacy.html')}">{'प्राइवेसी पॉलिसी' if hi else 'Privacy policy'}</a></li>
        </ul>
      </div>
    </div>
    <div class="foot-bottom">
      <span>&copy; <span id="year">{datetime.date.today().year}</span> {BRAND}. {'भारत में बना।' if hi else 'Made in India.'}</span>
      <span>smartgurukul.org</span>
    </div>
  </div>
</footer>"""


def canonical(meta):
    p = meta["path"]
    if p == "index.html":
        return f"{SITE}/"
    if p.endswith("/index.html"):
        return f"{SITE}/{p[:-len('index.html')]}"
    return f"{SITE}/{p}"


def breadcrumb(meta):
    if meta["path"] in ("index.html", "hi/index.html", "404.html"):
        return None
    hi = meta.get("lang") == "hi"
    return {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": BRAND_HI if hi else BRAND,
             "item": f"{SITE}/hi/" if hi else f"{SITE}/"},
            {"@type": "ListItem", "position": 2, "name": meta["crumb"], "item": canonical(meta)},
        ],
    }


def faq_schema(body):
    """FAQPage JSON-LD built from the page's own <details class="qa"> blocks, so markup never drifts from content."""
    items = []
    for q, a in re.findall(r'<details class="qa">\s*<summary>(.*?)</summary>(.*?)</details>', body, re.S):
        text = re.sub(r"<[^>]+>", " ", a)
        text = html.unescape(re.sub(r"\s+", " ", text)).strip()
        text = re.sub(r"\s+([.,;:!?।])", r"\1", text)  # "policy ." left behind by a stripped </a>
        items.append({"@type": "Question", "name": html.unescape(re.sub(r"<[^>]+>", "", q)).strip(),
                      "acceptedAnswer": {"@type": "Answer", "text": text}})
    return {"@type": "FAQPage", "mainEntity": items} if items else None


def head(meta, body):
    p = meta["path"]
    lang = meta.get("lang", "en")
    url = canonical(meta)
    title = meta["title"]
    desc = meta["description"]
    graph = [ORG, WEBSITE]
    software = meta.get("software", True)
    if software:
        graph.append(SOFTWARE)
    about = f"{SITE}/#app" if software else f"{SITE}/#org"
    if meta.get("service"):
        graph.append(SERVICE)
        about = SERVICE["@id"]
    page = {"@type": "WebPage", "@id": url + "#page", "url": url, "name": title, "description": desc,
            "isPartOf": {"@id": f"{SITE}/#website"}, "about": {"@id": about},
            "inLanguage": "hi-IN" if lang == "hi" else "en-IN", "dateModified": DATES[p]}
    graph.append(page)
    for extra in (breadcrumb(meta), faq_schema(body)):
        if extra:
            graph.append(extra)
    ld = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=1)
    hreflang = ""
    if meta.get("hreflang"):
        en_url, hi_url = meta["hreflang"]
        hreflang = (f'<link rel="alternate" hreflang="en-IN" href="{SITE}/{en_url}">\n'
                    f'<link rel="alternate" hreflang="hi-IN" href="{SITE}/{hi_url}">\n'
                    f'<link rel="alternate" hreflang="x-default" href="{SITE}/{en_url}">\n')
    robots = "noindex, follow" if meta.get("noindex") else "index, follow, max-image-preview:large, max-snippet:-1"
    # Both 500 weights are in use: Mukta 500 by the hero chips (.chip small), Poppins 500 by the nav and form labels.
    fonts = "family=Poppins:wght@500;600;700&family=Mukta:wght@400;500;600;700;800"
    if meta.get("og_headline"):
        og_img = f"{SITE}/{og_card_path(p)}"
        og_alt = meta.get("og_image_alt", OG_ALT_PREFIX[lang] + meta["og_headline"])
    else:
        og_img = f"{SITE}/{OG_DEFAULT}"
        og_alt = meta.get("og_image_alt", OG_IMAGE_ALT[lang])
    og_alt = html.escape(og_alt)
    og_title = html.escape(meta.get("og_title", title))
    locale_alt = ""
    if meta.get("hreflang"):
        locale_alt = f'<meta property="og:locale:alternate" content="{"en_IN" if lang == "hi" else "hi_IN"}">\n'
    return f"""<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<meta name="robots" content="{robots}">
<link rel="canonical" href="{url}">
{hreflang}<meta name="theme-color" content="#7C3AED">
<link rel="icon" href="{rel(p, 'assets/brand/favicon.svg')}" type="image/svg+xml">
<link rel="icon" href="{rel(p, 'assets/brand/favicon-48.png')}" type="image/png" sizes="48x48">
<link rel="apple-touch-icon" href="{rel(p, 'assets/brand/apple-touch-180.png')}">
<link rel="manifest" href="{rel(p, 'site.webmanifest')}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{BRAND}">
<meta property="og:title" content="{og_title}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{og_img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{og_alt}">
<meta property="og:locale" content="{'hi_IN' if lang == 'hi' else 'en_IN'}">
{locale_alt}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{og_title}">
<meta name="twitter:description" content="{html.escape(desc)}">
<meta name="twitter:image" content="{og_img}">
<meta name="twitter:image:alt" content="{og_alt}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?{fonts}&display=swap">
<link rel="stylesheet" href="{rel(p, 'assets/site.css')}?v={ASSET_VERSION['assets/site.css']}">
<script type="application/ld+json">
{ld}
</script>
</head>"""


PILOT_BAND = {
    "en": ("Try it free for a month",
           "We import your register and train your staff. You decide after a month of real use.",
           "Book a free demo"),
    "hi": ("एक महीना मुफ़्त आज़माएँ",
           "हम आपका छात्र रजिस्टर इम्पोर्ट करते हैं और आपके स्टाफ़ को ट्रेनिंग देते हैं। एक महीने के असली इस्तेमाल के बाद आप फ़ैसला करें।",
           "मुफ़्त डेमो बुक करें"),
}


def pilot_band(meta, body):
    """The demo CTA plus the free 1-month pilot (a brand rule for every CTA), for product pages that
    don't already end in one. Pages with the demo form, noindex pages and non-product pages are skipped."""
    if meta.get("has_form") or meta.get("noindex") or not meta.get("software", True) or "cta-band" in body:
        return ""
    hi = meta.get("lang") == "hi"
    title, line, button = PILOT_BAND["hi" if hi else "en"]
    href = rel(meta["path"], ("hi/index.html" if hi else "index.html") + "#demo")
    return f"""

<section style="padding-top:0">
  <div class="wrap">
    <div class="cta-band">
      <div><h2>{title}</h2><p>{line}</p></div>
      <a class="btn btn-gold" href="{href}">{button}</a>
    </div>
  </div>
</section>"""


def mark_english_links(path, doc):
    """On a Hindi page, add hreflang="en" to every link that goes to an English page, so the language
    change is announced (the visible "(अंग्रेज़ी में)" cue is in the page copy where it fits)."""
    def mark(m):
        tag, url = m.group(0), m.group(1)
        if "hreflang=" in tag:
            return tag
        hit = resolve(path, html.unescape(url))
        if hit is None or hit[0].startswith("hi/") or not hit[0].endswith(".html"):
            return tag
        return tag.replace(f'href="{url}"', f'href="{url}" hreflang="en"', 1)
    return re.sub(r'<a\b[^>]*?\shref="([^"]*)"[^>]*>', mark, doc)


def redirect_page(old, new):
    """A tiny page at a moved URL: instant meta refresh plus a canonical, so search engines treat it as a
    redirect (GitHub Pages can't send a real 301). No noindex, which would contradict the canonical."""
    url = f"{SITE}/{new}"
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>This page has moved | {BRAND}</title>
<link rel="canonical" href="{url}">
<meta http-equiv="refresh" content="0; url={new}">
<style>body{{font:18px/1.6 system-ui,sans-serif;margin:0;padding:48px 16px;color:#1E1633;background:#fff}}main{{max-width:640px;margin:auto}}a{{color:#7C3AED}}</style>
</head>
<body>
<main>
<h1>This page has moved</h1>
<p>It now lives at <a href="{new}">{url}</a>.</p>
</main>
</body>
</html>
"""


def read_pages():
    pages = []
    for src in sorted((ROOT / "pages").glob("**/*.html")):
        raw = src.read_text(encoding="utf-8")
        m = re.match(r"\s*<!--meta\s+(\{.*?\})\s*-->\s*", raw, re.S)
        if not m:
            raise SystemExit(f"{src}: missing <!--meta {{...}} --> block")
        meta = json.loads(m.group(1))
        meta["_src"] = src
        pages.append((meta, raw[m.end():]))
    return pages


def write_llms(indexable):
    """docs/llms.txt: the facts block plus every indexable page, so it can't drift from the site again."""
    order = lambda m: (m.get("lang") == "hi", -float(m.get("priority", "0.7")), m["path"])
    pages, optional = [], []
    for meta in sorted(indexable, key=order):
        name = {"index.html": "Home", "hi/index.html": "Hindi homepage"}.get(meta["path"], meta.get("crumb"))
        line = f"- [{name}]({canonical(meta)}): {meta['description']}"
        (optional if meta.get("llms") == "optional" else pages).append(line)
    latest = max(DATES[m["path"]] for m in indexable)
    text = (LLMS_FACTS + f"\n\nLast updated: {latest}\n\n## Pages\n\n" + "\n".join(pages)
            + "\n\n## Optional\n\n" + "\n".join(optional) + "\n")
    (OUT / "llms.txt").write_text(text, encoding="utf-8", newline="\n")
    print("built llms.txt with", len(pages) + len(optional), "pages")


def write_sitemap(indexable):
    urls = []
    for meta in indexable:
        alts = ""
        if meta.get("hreflang"):
            en_url, hi_url = meta["hreflang"]
            alts = (f'\n    <xhtml:link rel="alternate" hreflang="en-IN" href="{SITE}/{en_url}"/>'
                    f'\n    <xhtml:link rel="alternate" hreflang="hi-IN" href="{SITE}/{hi_url}"/>'
                    f'\n    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE}/{en_url}"/>')
        urls.append(f"  <url>\n    <loc>{canonical(meta)}</loc>\n    <lastmod>{DATES[meta['path']]}</lastmod>{alts}\n"
                    f"    <priority>{meta.get('priority', '0.7')}</priority>\n  </url>")
    (OUT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + "\n".join(urls) + "\n</urlset>\n", encoding="utf-8", newline="\n")
    print("built sitemap.xml with", len(urls), "urls")


# ---------------------------------------------------------------------------------------------------
# Checks on the generated output. FAIL stops the build (exit 1); WARN is printed for a human to review.

BANNED = [  # (pattern, flags): claims and names that must never appear on an indexable page
    (r"video call", re.I), (r"वीडियो कॉल", 0), (r"school groups", re.I),
    (r"transport and bus tracking", re.I), (r"\bERP\b", 0), (r"Balaji", re.I), (r"\bJNV\b", 0),
    # Sign-in has two paths (WhatsApp code or username and password); only the WhatsApp code shows every
    # child on a number (a parent account covers one child). Some app screens, teachers' class attendance
    # and class lists among them, are still English-only, so never say only "a few" screens are.
    (r"Sign-in uses a one-time code", re.I), (r"whole app to Hindi", re.I), (r"All children, one login", re.I),
    (r"on one sign-in", re.I), (r"यूज़र के फ़ोन पर वन-टाइम कोड भेजा जाता है", 0), (r"पूरा ऐप हिंदी", 0),
    (r"\ba few (?:app )?screens\b", re.I),
    # A parent's attendance history and chat list are still English-only, so not every parent screen is in
    # Hindi; and the language button opens a menu, so switching language takes two taps, not one.
    (r"\bparent screens\b", re.I), (r"अभिभावकों की स्क्रीन", 0), (r"\bin one tap\b", re.I), (r"एक टैप में", 0),
    # XP comes only from attendance and quiz wins (Gurukul_bk awards XpSource ATTENDANCE, QUIZ_WIN and
    # BATTLE_ROOM_WIN, nothing else). Assessment results earn none, and teachers award house points, not XP.
    # (Case-sensitive "XP", so the class="xp" badges don't count as the word.)
    (r"\bXP\b[^.<;]{0,80}\b(?i:results|participation)\b|\b(?i:results|participation|doing well)\b[^.<;]{0,60}\bXP\b",
     0),
    (r"\+XP · नतीजे", 0), (r"अच्छा करने पर XP", 0),
    # "एक से एक" is an idiom ("each one better than the last"); it doesn't say one-to-one.
    (r"एक-से-एक", 0),
]
# App labels quoted on the site (<span class="ui">) must be the app's own text, from these files.
LOCALES = REPO / "src" / "i18n" / "locales"
UI_LABEL = re.compile(r'<span class="ui">(.*?)</span>', re.S)
_LABELS = {}


def app_labels(lang):
    """Every string in the app's en.json or hi.json, normalised like a quoted label."""
    if lang not in _LABELS:
        def walk(value):
            if isinstance(value, dict):
                for v in value.values():
                    yield from walk(v)
            elif isinstance(value, str):
                yield norm_label(value)
        data = json.loads((LOCALES / f"{lang}.json").read_text(encoding="utf-8"))
        _LABELS[lang] = set(walk(data))
    return _LABELS[lang]


def norm_label(text):
    # The site writes curly apostrophes (house style); the app's strings use straight ones.
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", text))).replace("’", "'").strip()


def png_size(path):
    """(width, height) from a PNG's IHDR chunk, or None when the file isn't a PNG."""
    with open(path, "rb") as f:
        head = f.read(24)
    if len(head) < 24 or head[:8] != b"\x89PNG\r\n\x1a\n" or head[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", head[16:24])
BARE_NAME = re.compile(r"(?<!Smart )\bGurukul\b(?! Arena| Master)")
BARE_NAME_HI = re.compile(r"(?<!स्मार्ट )गुरुकुल(?! एरीना| मास्टर)")
EXTERNAL = re.compile(r"^(?:[a-z][a-z0-9+.-]*:|//)", re.I)


def visible_text(doc):
    doc = re.sub(r"<script\b.*?</script>|<style\b.*?</style>|<!--.*?-->", " ", doc, flags=re.S | re.I)
    return html.unescape(re.sub(r"<[^>]+>", " ", doc))


def ld_strings(value):
    """Every string in a JSON-LD value that isn't a URL or an @id."""
    if isinstance(value, dict):
        for k, v in value.items():
            if not k.startswith("@"):
                yield from ld_strings(v)
    elif isinstance(value, list):
        for v in value:
            yield from ld_strings(v)
    elif isinstance(value, str) and not value.startswith(("http://", "https://", "#")):
        yield value


def resolve(page, url):
    """docs/ file and fragment an internal link points to, or None for an external link."""
    if url.startswith(SITE + "/") or url == SITE:
        url = url[len(SITE):] or "/"
    elif url.startswith("https://www.smartgurukul.org"):
        url = url[len("https://www.smartgurukul.org"):] or "/"
    elif EXTERNAL.match(url):
        return None
    url, _, frag = url.partition("#")
    url = url.split("?", 1)[0]
    if not url:
        target = page
    elif url.startswith("/"):
        target = url[1:]
    else:
        base = page.rsplit("/", 1)[0] + "/" if "/" in page else ""
        parts = []
        for seg in (base + url).split("/"):
            if seg == "..":
                if parts:
                    parts.pop()
            elif seg != ".":
                parts.append(seg)
        target = "/".join(parts)
    if target == "" or target.endswith("/"):
        target += "index.html"
    return target, frag


def ids_in(path, cache={}):
    if path not in cache:
        f = OUT / path
        text = f.read_text(encoding="utf-8", errors="replace") if f.suffix == ".html" and f.exists() else ""
        cache[path] = set(re.findall(r'\sid="([^"]+)"', text))
    return cache[path]


def check(built):
    """built: [(meta, html)] for every page this run wrote. Returns (fails, warns)."""
    fails, warns = [], []
    try:
        manifest = json.loads((OUT / "assets" / "og" / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        manifest = {}
    for meta, doc in built:
        p = meta["path"]
        say = lambda bucket, msg: bucket.append(f"{p}: {msg}")
        indexable = not meta.get("noindex") and not meta.get("redirect")

        blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', doc, re.S)
        lds = []
        for block in blocks:
            try:
                lds.append(json.loads(block))
            except json.JSONDecodeError as e:
                say(fails, f"JSON-LD doesn't parse: {e}")
        h1s = len(re.findall(r"<h1[\s>]", doc))
        if h1s != 1:
            say(fails, f"{h1s} <h1> elements (want exactly 1)")

        faq_count = doc.count('<details class="qa">')
        ld_faq = sum(len(n.get("mainEntity", [])) for ld in lds for n in ld.get("@graph", [])
                     if n.get("@type") == "FAQPage")
        if faq_count != ld_faq:
            say(fails, f"{faq_count} FAQ blocks but {ld_faq} FAQPage questions")

        for img in re.findall(r"<img\b[^>]*>", doc):
            for attr in ("alt", "width", "height"):
                if not re.search(rf'\s{attr}="', img):
                    say(fails, f"<img> without {attr}: {img[:90]}")

        for attr, url in re.findall(r'\s(href|src)="([^"]*)"', doc):
            if attr == "href" and (url.endswith("index.html") or "index.html#" in url):
                say(fails, f"link to index.html: {url}")
            hit = resolve(p, html.unescape(url))
            if hit is None:
                continue
            target, frag = hit
            if not (OUT / target).is_file():
                say(fails, f"broken internal {attr}: {url}")
            elif frag and target.endswith(".html") and frag not in ids_in(target):
                say(fails, f"#{frag} not found in {target}: {url}")

        lang = meta.get("lang", "en")
        for label in UI_LABEL.findall(doc):
            if norm_label(label) not in app_labels(lang):
                say(fails, f'<span class="ui">{norm_label(label)}</span> is not an app label in '
                           f'src/i18n/locales/{lang}.json')

        if lang == "hi":
            for tag, url in re.findall(r'(<a\b[^>]*?\shref="([^"]*)"[^>]*>)', doc):
                if re.search(r'\sclass="lang"|\slang="', tag):
                    continue  # the language switches (header and footer) go to the English page on purpose
                hit = resolve(p, html.unescape(url))
                if hit and hit[0] in HI_OF:
                    say(fails, f"links to the English {hit[0]} although {HI_OF[hit[0]]} exists: {url}")

        if meta.get("og_headline"):
            for key, most in OG_TEXT_MAX.items():
                if len(meta.get(key, "")) > most:
                    say(fails, f"{key} is {len(meta[key])} characters (want at most {most})")
            card = og_card_path(p)
            f = OUT / card
            size = png_size(f) if f.is_file() else None
            if size is None:
                say(fails, f"{card} is missing or isn't a PNG (run python website/og_images.py)")
            else:
                if size != (1200, 630):
                    say(fails, f"{card} is {size[0]}x{size[1]} (want 1200x630)")
                if f.stat().st_size > OG_MAX_BYTES:
                    say(fails, f"{card} is {f.stat().st_size // 1024} KB (want at most {OG_MAX_BYTES // 1024} KB)")
                if manifest.get(p) != og_hash(meta):
                    say(fails, f"{card} doesn't match the page's og_eyebrow/og_headline "
                               "(run python website/og_images.py)")

        text = visible_text(doc)
        names = [text, meta["title"], meta["description"]] + [s for ld in lds for s in ld_strings(ld)]
        for chunk in names:
            for m in BARE_NAME.finditer(chunk):
                say(fails, f'bare "Gurukul": ...{chunk[max(0, m.start() - 40):m.end() + 20].strip()}...')
            for m in BARE_NAME_HI.finditer(chunk):
                say(fails, f'bare "गुरुकुल": ...{chunk[max(0, m.start() - 30):m.end() + 15].strip()}...')

        if indexable:
            for pattern, flags in BANNED:
                if p == "privacy.html" and pattern == "video call":
                    continue  # the privacy policy describes call data handling; that line is kept
                for m in re.finditer(pattern, doc, flags):
                    say(fails, f'banned phrase "{m.group(0)}": ...{doc[max(0, m.start() - 50):m.end() + 30]}...')
            if meta.get("lang") != "hi" and len(meta["title"]) > 60:
                say(warns, f"title is {len(meta['title'])} characters (over 60)")
            if not 120 <= len(meta["description"]) <= 160:
                say(warns, f"description is {len(meta['description'])} characters (want 120-160)")
    for pattern, flags in BANNED:  # the llms.txt facts block makes the same claims as the pages
        for m in re.finditer(pattern, LLMS_FACTS, flags):
            fails.append(f'llms.txt: banned phrase "{m.group(0)}": '
                         f'...{LLMS_FACTS[max(0, m.start() - 50):m.end() + 30]}...')
    return fails, warns


def build():
    # A FAIL message can quote Hindi text; a Windows console (cp1252) would otherwise crash on it.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="backslashreplace")
    pages = read_pages()
    for meta, _ in pages:
        if meta.get("lang") == "hi" and meta.get("alternate"):
            HI_OF[meta["alternate"]] = meta["path"]
        DATES[meta["path"]] = page_date(meta["_src"])
    for asset in ("assets/site.css", "assets/site.js"):
        ASSET_VERSION[asset] = asset_version(asset)

    built = []
    for meta, body in pages:
        mobile_cta = ""
        if not meta.get("has_form") and not meta.get("noindex"):
            hi = meta.get("lang") == "hi"
            target = rel(meta["path"], ("hi/index.html" if hi else "index.html") + "#demo")
            mobile_cta = (f'<div class="mobile-cta"><a class="btn btn-primary" href="{target}">'
                          f'{"मुफ़्त डेमो बुक करें" if hi else "Book a free demo"}</a></div>')
        doc = (head(meta, body)
               + f'\n<body class="{"has-mobile-cta" if mobile_cta else ""}">\n'
               + header(meta) + '\n<main id="main">\n' + body.strip() + pilot_band(meta, body) + "\n</main>\n"
               + footer(meta) + "\n" + mobile_cta
               + f'\n<script src="{rel(meta["path"], "assets/site.js")}?v={ASSET_VERSION["assets/site.js"]}" defer></script>\n</body>\n</html>\n')
        if meta.get("lang") == "hi":
            doc = mark_english_links(meta["path"], doc)
        out = OUT / meta["path"]
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(doc, encoding="utf-8", newline="\n")
        built.append((meta, doc))
        print("built", meta["path"])

    for old, new in REDIRECTS.items():
        doc = redirect_page(old, new)
        (OUT / old).write_text(doc, encoding="utf-8", newline="\n")
        built.append(({"path": old, "title": f"This page has moved | {BRAND}", "description": "",
                       "redirect": True}, doc))
        print("built redirect", old, "->", new)

    indexable = [m for m, _ in pages if not m.get("noindex")]
    write_sitemap(indexable)
    write_llms(indexable)

    fails, warns = check(built)
    for w in warns:
        print("WARN", w)
    for f in fails:
        print("FAIL", f)
    print(f"checks: {len(built)} pages, {len(fails)} FAIL, {len(warns)} WARN")
    if fails:
        sys.exit(1)


if __name__ == "__main__":
    build()
