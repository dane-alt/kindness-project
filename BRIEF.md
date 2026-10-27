# Kindness Project Hub: Build Brief

Attention: Grok and Grokbot. Please build, test and deploy this in Dane's GitHub, working with Cursor. Make the technical choices you judge best and record them in the README. Save this brief in the repo as BRIEF.md.

## What it is

A free, phone-first website reached by QR codes printed on cards and in the book *Kindness* by Dane E. Rose. People share kind acts anonymously, and the collection becomes a living record of kindness that can appear in the book.

## Flow 1: QR code 1, "Kindness received and given"

1. Screen one: "What is the kindest thing anyone has ever done for you, and how do you feel about it?"
2. Screen two: "What is one of the kindest things you've done for someone else?"
3. Each answer by audio, typed text, or audio transcribed to text.
4. Fully anonymous, with no account or login.
5. A plain consent line before submitting: entries are public and may appear in the book *Kindness*.
6. After submitting, the person sees everyone else's entries. Entries stay hidden until then.

## Flow 2: QR code 2, "Kind acts inspired"

1. "Have you done a kind act for yourself or someone else inspired by the Kindness Project?"
2. They share it anonymously (same audio, text and transcription options).
3. Then they see others' inspired acts.
4. Final screen: an easy way to share the Kindness Project with people they think would enjoy it.

## Also include

- A running tally of kind acts shared, and a feed.
- Book-copy tracking: each printed copy gets a short code; finders enter it to log where the copy traveled and what kindness it prompted.
- Moderation: automatic filtering of names, phone numbers, emails and abusive text, plus a simple admin review screen for Dane.
- Export of approved entries (CSV and JSON) with the consent flag, for use in the book.
- Print-ready QR codes (SVG and PNG) for both flows, sized for 4x6 cards.

## Standards

- Fast on mid-range phones, readable and accessible, warm and simple in tone.
- Free or near-free hosting.
- Privacy first: store only what people choose to share.

## Testing before reporting done

- Both flows end to end on iPhone Safari and Android Chrome, including microphone permission and transcription.
- Moderation filter, admin screen, exports and book-code logging.
- A short written test report in the repo (TEST-REPORT.md).

## When it's done

Email daneeaster@gmail.com with the subject **"Kindness Project hub: build complete -- from Grok"**, cc dane@mysticallandscapes.com, and include:

- the repo URL
- the live URL
- the QR code files
- admin login steps
- the test report
