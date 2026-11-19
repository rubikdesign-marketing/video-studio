# First-time creator trial

For two people who have never used the studio, each on a Mac that has never had it installed. About 90 minutes each. The owner (or a helper) watches and takes notes; they do not help unless the person is stuck for more than five minutes, and every bit of help is written down.

## Before

- A Mac with 10 GB free, the Claude desktop app signed in with a plan that includes Claude Code.
- No keys are needed. If the person wants a voice-over, they bring their own ElevenLabs key; otherwise the film uses type and library sound.
- The person brings a brand that is not Tulvo (their own business, a friend's, or an invented one), its logo as SVG or PNG and two colours, and one sentence about what the video should say. Optional: a reference video they like.
- The watcher has: this page, a timer, and `docs/release-test-2026-11-18.md` for what "working" looks like.

## The tasks

Read each task to the person as written. Start the timer at task 1.

1. **Install.** "Follow ONBOARDING.md." Record: time to a passing health check; every place they hesitated; anything the check said that they did not understand.
2. **Your brand.** "Set up your brand." Record: time; whether the colours and logo looked right on the brand sheet the first time.
3. **Your video.** "Describe the video you want in your own words, and make it." Record: the exact words they typed; every question Claude asked, and whether the person found it necessary; time to the first preview they could watch.
4. **One change.** After watching the preview with sound: "Change one specific thing you don't like." Record: their words; whether the report said the change landed; whether **they** agree it landed and nothing else moved.
5. **Export.** "Get the final file and play it on your phone with sound." Record: time; whether it plays; the size; anything that looks wrong on the phone.
6. **Interrupted job.** While the master renders, the watcher quits the Claude app. Reopen it and say: "Carry on with my video." Record: whether Claude found the job and continued; whether the last preview was still there; whether anything had to be redone.
7. **Second video.** "Make another one in the same style, about something else." Record: questions asked; time to its first preview; whether it looks like the same series.

## After

Ask, and write down the answers word for word:

- Would you use this for your next video? What would stop you?
- What would you pay for it per month, and what would make it worth more?
- What did you expect it to do that it didn't?
- Which moment was most confusing?

Then run `node tools/film/costs.mjs jobs/<their job>` and record the machine time, and the token use from the Claude app if it shows it.

## What counts as passing

All seven tasks done with no more than two helps in total, the change in task 4 recognised by the person as theirs, the export playing with sound on their phone, task 6 continuing without redoing finished work, and task 7 reaching a preview with no more than two questions. Anything short of this is a fix list for the next release, then the trial is run again with two new people.
