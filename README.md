# haz-u-nullcurse

Nullscape's fan-made run toolkit. Serve this directory with any static HTTP
server, then open `index.html` (or the directory root).

The landing starts black for half a second. Five logo sections arranged
left-to-right enter one per note, alternating from above and below in sync with
the opening motif (D4, F5, E5, Bb4, A4). The finished logo replaces the sections
so no seams remain, then moves up as the feature tags and Enter button appear.
The original tag colors are kept in five equal-width columns with no wrapping;
narrow screens scroll the single row horizontally. The tracker background
uses subtle parallax and a light vignette. The original logo is kept
in `assets/branding/Nullscape.png`; the new asset and generation prompt are
`assets/branding/NullscapeToolkits.png` and `NullscapeToolkits.prompt.txt`.
Reduced motion disables landing motion. Low-detail mode affects only the toolkit;
the landing page keeps its full appearance, intro, and parallax.

`js/intro.js` contains the note pitches, rhythmic positions, tempo, initial
silence and reveal timing. Web Audio synthesizes the phrase locally, with
reverb and an echo on the final note; no video or remote audio is embedded.
Note pitches and rhythmic positions were read from the opening piano roll at
https://www.youtube.com/watch?v=k5uD12p0rEs. The intro arrangement uses 160 BPM.
The audio clock drives animation when sound is allowed. On a fresh browser
visit, autoplay may be blocked: the animation still runs automatically, and
a click/tap or key during the assembly restarts it with synchronized sound.
There is no delayed surprise playback after the controls appear. Direct tool
links and reduced motion skip the intro. Tool navigation and
returning home never replay it.

The landing and tools share one document. Shared links can use `#/curses`,
`#/upgrades`, `#/deaths`, `#/altars`, or `#/lobby`; `#/` returns home. The original
floating buttons and hotkeys switch tools without an added navigation bar or
page transition. Panel changes replace the current URL so Back returns to the
landing instead of walking through every tool selection.

`Toolkits.html` redirects old bookmarks to the shell and provides the tool
markup imported once. Scripts initialize on first entry and remain loaded when
returning home. Local styles, scripts, and the images in `assets/preload.json`
preload silently, with six image requests at a time. Update the manifest when
adding or removing images. Required resource failures expose a retry control.
