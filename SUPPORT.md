# Getting help

One table for "where do I ask". Issues are for things that change this repository; everything else has a faster place.

| I want to… | Go to |
| :--- | :--- |
| Learn to build, play, make patterns for one or give it sound and MIDI | [The guide](https://patternflow.work/guide) — each step on a 3D Patternflow in the browser. A step that didn't get you through has a **Stuck here?** link, which opens an issue with that step filled in |
| Get unstuck building, soldering or flashing | [Discord → hardware-help](https://discord.com/channels/1497757947827327067/1499907910707187833) — photos and quick back-and-forth |
| Flash the DevKit for the first time, or get the panel onto Wi-Fi | [The Play guide's Flash chapter](https://patternflow.work/guide/play#flash), or [`BUILD_GUIDE.md` §8](BUILD_GUIDE.md#8-firmware) in writing. The short version is below the table |
| Show a pattern I made, or get feedback on one | Publish it from the [Pattern Lab](https://patternflow.work/pattern-lab) to the [Community](https://community.patternflow.work/community), then [Discord → patterns](https://discord.com/channels/1497757947827327067/1499908302962819236) |
| Put my finished build on the [build map](https://patternflow.work/inside) | [Share your build](https://github.com/engmung/Patternflow/issues/new?template=share_build.yml) — or post it in Discord |
| Talk about where the project should go, or find people working on the same direction | [Discord](https://discord.gg/Vr9QtsxeTk) — the dev-log and the project channels |
| Report a bug, a wrong or missing doc, or propose a feature | [New issue](https://github.com/engmung/Patternflow/issues/new/choose) — pick the template |
| Report a security problem | [SECURITY.md](SECURITY.md) — privately, not as an issue |
| Contribute code, hardware files or docs | [CONTRIBUTING.md](CONTRIBUTING.md) |

**The first flash, in short.**

1. The DevKit out of the board, on its **left** USB-C port (labelled `USB`), with a cable that carries data — a charge-only cable is the most common reason nothing shows up — in desktop Chrome or Edge. That port is for flashing and data only; the panel is always powered through `J4`, the screw terminal.
2. **Download mode, every first flash:** hold **BOOT**, tap **RST**, let go of BOOT. Then press **Flash Patternflow** (on the [Pattern tab](https://patternflow.work/pattern) under *Got the hardware?*, or in the Play guide) and pick the port (`USB JTAG/serial debug unit`).
3. **The Wi-Fi step usually does not appear** after *Installation complete!* That is expected: press **RST** once, press **Flash Patternflow** again, pick the port, choose **Connect to Wi-Fi**, and after about ten seconds of scanning type your network's name exactly (capitals count; 2.4 GHz only) and its password.
4. **If that will not take,** put the DevKit back in the board and power it: about 15 seconds after it finds no network it knows, the panel raises its own, `patternflow-xxxx` (password `patternflow`; hold **K2** to see the exact name). Not in your phone's list yet? Wait, and refresh the list. Join it (the phone will say the network has no internet, which is true; stay on it), open `http://192.168.4.1/`, and pick your network on the Wi-Fi page.

A board that already runs Patternflow is updated over Wi-Fi from its console's Update page instead — download mode erases the patterns and saved networks.

**If Discord is blocked where you live**, the community site still works for patterns and decks without it, and a bug or a documentation issue here reaches the maintainer the same day. A discussion venue that works everywhere is planned; until it exists, an issue is the fallback for a question too.

There is no support email. Replies come from the maintainer and from other builders, usually within a day or two.
