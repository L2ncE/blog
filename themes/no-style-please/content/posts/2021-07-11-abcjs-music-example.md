---
title: "Music abc examples"
extra:
  music_abc: true
---

## Test

> Test

{{ music_abc(abc="C,D,E,F,G,A,B,CDEFGABcdefgabc'd'e'f'g'a'b'") }}

## Cooley's

> With audio

{{ music_abc(audio=true, abc="
X: 1
T: Cooley's
M: 4/4
L: 1/8
R: reel
K: Emin
|:D2|EB{c}BA B2 EB|~B2 AB dBAG|FDAD BDAD|FDAD dAFD|
EBBA B2 EB|B2 AB defg|afe^c dBAF|DEFD E2:|
|:gf|eB B2 efge|eB B2 gedB|A2 FA DAFA|A2 FA defg|
eB B2 eBgB|eB B2 defg|afe^c dBAF|DEFD E2:|
") }}

## His Theme

> With audio and midi downloader

{{ music_abc(audio=true, midi=true, abc="
X: 1
T: Undertale: His Theme
V: T clef=treble
V: B clef=bass
L: 1/8
M: 4/4
K: B
Q: 1/4=90
[V: T] !mp! [|: fc'bf a3/2a3/2b- | bfbf a3/2a3/2b | fc'bf a3/2a3/2b- | bfbd' c'3/2b3/2c' :|]
[V: B] [|: E8 | F8 | G8 | B8 :|]
[V: T] !mf! [|: fc'bf a3/2a3/2b- | bfbf a3/2a3/2b | fc'bf a3/2a3/2b- | bfbd' c'3/2b3/2c' :|]
[V: B] [|: E,2 B,2 F2 B,2 | F,2 B,2 A2 F2 | G,2 D2 A2 D2 | B,2 F2 c2 B2:|]
[V: T] [|: fc'bf a3/2a3/2b- | bfbf a3/2a3/2b | fc'bf a3/2a3/2b- | bfbd' c'3/2b3/2c' :|]
[V: B] [|: E,2 B,2 F2 B,2 | F,2 B,2 A2 F2 | G,2 D2 A2 D2 | B,2 F2 c2 B2:|]
[V: T] !f! [|: fc'bf [a3/2f3/2][a3/2f3/2]b- | bfbf [a3/2f3/2][a3/2f3/2]b | fc'bf [a3/2f3/2][a3/2f3/2]b- | bfbd' [c'3/2f3/2][b3/2f3/2][c'f] :|]
[V: B] [|: [E,2E8] B,2 F2 B,2 | [F,2F8] B,2 A2 F2 | [G,2G8] D2 A2 D2 | [B,2B8] F2 c2 B2 :|]
[V: T] [|: fc'bf [a3/2f3/2][a3/2f3/2]b- | bfbf [a3/2f3/2][a3/2f3/2]b | fc'bf [a3/2f3/2][a3/2f3/2]b- | bfbd' [c'3/2f3/2][b3/2f3/2][c'f] :|]
[V: B] [|: [E,E]2 B,2 F2 B,2 | [F,F]2 B,2 A2 F2 | [G,G]2 D2 A2 D2 | [B,B]2 F2 c2 B2 :|]
[V: T] !mf! fc'bf a3/2a3/2[bf]- | [f6b6]-[f2b2] |]
[V: B] [E4B,4] [E4F,4] | z8 |]
") }}
