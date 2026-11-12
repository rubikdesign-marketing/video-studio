# spreshapp_7742418953992431 — analysis

**Duration / format:** 109.4 seconds, portrait 9:16 source. A wide desktop recording sits across the middle, with a small presenter webcam inset near the lower left. This is a tutorial segment titled “Cursor Agent: Pro Tips 3. Custom Commands.” The presenter demonstrates making a custom slash command from a Markdown file and using it to create a GitHub pull request. The likely audience is developers already using Cursor Agent who want to automate repeated repo tasks. The source folder does not establish official Cursor authorship, so treat it as a tutorial sample in the collection.

## Hook and promise

The opening is an informational series frame rather than a high-drama claim. The presenter says, “Let’s cover one of our 10 pro tips for working with Cursor Agents” (00:00–00:04.32), then identifies the third tip: creating custom commands (00:06.92–00:10.20). The visual title card makes the topic explicit. The promise is practical and bounded: create a reusable command named `/pr`, encode instructions in a `.md` file, run it in Agent, and get a pull-request link. Unlike the conceptual interview clips, nearly the whole payoff is demonstrated in the interface.

## Beat map

- **00:00–00:10:** The presenter appears in a small webcam window over a desktop recording. A minimal title card says “Cursor Agent: Pro Tips 3. Custom Commands,” then the presenter introduces the numbered segment. The series framing signals that this is one installment in a larger tutorial.
- **00:10–00:20:** In a code/editor-style view, he navigates to the Cursor folder, creates a `commands` folder, and explains that Markdown files can serve as commands. The transcript names the file `pr.md` (00:19.34–00:22.70). This makes the concept concrete before he explains the syntax.
- **00:20–00:30:** He shows that the filename can be chosen freely and describes putting a prompt in it to make PRs. The visible editor moves through the instruction file, while the narration describes the desired task.
- **00:30–00:58:** The prompt content is entered: “create a PR with a descriptive title,” “Always use the GitHub CLI,” optional rules or commit guidelines, and a condition to commit first if no commit exists. The transcript captures these instructions between 00:30.14 and 00:57.06. The editor is the primary proof surface; a viewer can see the file taking shape, although the small inset in the full-screen capture limits line-level legibility in some sampled frames.
- **00:58–01:13:** The presenter switches to the Agent panel, types slash, and demonstrates the custom command appearing as an option. He selects `/pr`, shows a hover preview of the saved prompt, and runs it. This is the key discovery/activation step and a good visual payoff for the earlier file setup.
- **01:13–01:25:** He explains what he hopes the command will do: call a shell command and GitHub CLI, first commit and then create a PR. The agent checks status. This distinction matters: the narration frames the expected workflow before the software executes.
- **01:25–01:46:** He opens source control, notes there are changes on the branch that need committing, and says the agent will inspect changes to infer the PR description. At 01:41.82, he reports completion and points to a link to the new pull request, ending “Nice” (01:43.06–01:46.74). The final result is a visible artifact rather than a generic capability claim.

The beat map is aligned to transcript timestamps and nominal sampled frames. The 3-second contact sheets show the desktop remaining dominant and the presenter inset staying near the lower-left. They do not establish exact transition effects or the full cursor movement between sampled frames.

## Visual hierarchy and editing

The screen recording uses a light desktop/editor view against a neutral background, with code text and panels providing the visual detail. The presenter is kept in a small persistent inset instead of cutting away to full-frame face shots. This lets the tutorial remain anchored in the interface while preserving a human guide. A few title-card moments separate the series framing from the live demo. There are no large subtitle graphics in the sampled frames; the visual hierarchy is the active editor panel, Agent side panel, and the presenter window. The screen itself carries dense information, so the pacing is slower than the creator shorts in the collection and gives the viewer time to follow navigation and execution.

The strongest design decision is sequencing: teach how to create the command, reveal it in the slash menu, then run it and show the result. The hover preview is especially useful because it confirms the saved text is callable as a tool-like shortcut. The tutorial would be easier to replicate with a temporary zoom/crop when describing exact prompt lines, but its full-screen desktop capture is coherent and uninterrupted enough to follow.

## Proof, trade-offs, and replication

The proof chain is unusually complete: a Markdown prompt file becomes a slash command, the Agent executes it against visible repository changes, and the presenter reports receiving a PR link. This is a stronger demonstration than merely reading a feature list. Still, the transcript reports the result; the sampled imagery cannot verify the PR contents, quality, or whether every listed action occurred exactly as described. The command text includes a consequential instruction to create a PR, so this should be treated as an example workflow, not as an endorsement to run blindly on every repository.

A beginner can reproduce the structure with a numbered series label, one concrete use case, a visible file setup, a preview of the command in context, and an end-to-end run with a verifiable output. Keep the prompt readable on screen and distinguish what the presenter expects from what the tool actually did. This sample's strength is a clear, reusable workflow and a satisfying artifact; its trade-off is the length and amount of small on-screen text.

**Transcript note:** Local MLX Whisper small transcription is unverified, but the named file, command, and steps are repeated coherently. The outcome (“a link to my new pull request”) is the presenter’s report, not independent verification of that PR. The tutorial has no explicit audience CTA beyond the “Nice” close.

## Source and evidence files

- [Original MP4](../../../Cursor/spreshapp_7742418953992431.mp4).
- [Spoken machine transcript](transcript.md), [raw recognition and segment confidence](transcript.json), [subtitles](transcript.srt), and [automatic review notes](transcript-review.md).
- [Source metadata](metadata.json), [structured observations](evidence.json), and [local audio signal measurements](audio-signal.json).
- Contact sheets: [contact_01.jpg](contact_01.jpg), [contact_02.jpg](contact_02.jpg), [contact_03.jpg](contact_03.jpg), [contact_04.jpg](contact_04.jpg). Individual three-second frames are in `frames/`.
