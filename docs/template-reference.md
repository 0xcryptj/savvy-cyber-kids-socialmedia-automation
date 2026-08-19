# SCK-SM template reference

The supplied local reference is `/home/nano/Downloads/SCK-SM Templates.mp4`.
It is a 1080×1350 H.264 export of the Canva template and is the visual source
of truth when Canva's web editor is unavailable behind Cloudflare.

## Brand rules visible in the reference

- Canvas: 1080×1350, portrait 4:5.
- Primary type: Asap Regular, Medium, SemiBold, and Bold.
- Specialty type: Sketch Block Bold, used for decorative headlines such as
  “THANK YOU”, “BOOKS”, and “VOLUNTEER”.
- Colors: orange `#f7941d`, light blue `#00aeef`, medium blue `#008abd`,
  dark blue `#004d76`, black, and white.
- Logo: Savvy Cyber Kids shield, generally centered at the bottom or placed
  near the upper-right on photo-led article layouts.

## Page variants in the video

1. Brand specifications and editable placeholder notes.
2. General article / online behavior: photo-led upper canvas, black fade,
   centered category label, orange divider, white headline with light-blue
   emphasis, and logo.
3. Conversation Starters: pale background, speech-bubble illustration,
   large left-aligned blue headline, phone/device image, and logo.
4. Breaking News: photo-led header, orange `BREAKING NEWS` ribbon, white
   supporting copy on black, and orange footer rule.
5. Resources / Books: cyan header strip with decorative title treatment,
   white content field, QR or book artwork, and bottom logo.
6. Thank You: dark smoky background, Sketch Block Bold orange title, centered
   supporting copy, bottom logo, and orange footer rule.
7. Volunteer: dark background, outlined orange/white title, framed media,
   attribution copy, bottom logo, and orange footer rule.
8. Partnership / New Board Members / Raffle: pale patterned background,
   orange speech-ribbon title, image or circular portraits, and bottom logo.
9. Tuesday Tips: blue radial background, lightbulb illustration, centered
   black copy, and bottom logo.

The local renderer currently implements variant 2, the article-generation
path. The other variants are preserved here so future renderer variants can be
added against the supplied reference rather than inferred from the Canva link.
