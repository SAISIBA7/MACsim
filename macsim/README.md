# MACSim

MACSim is a browser-based educational simulator for Pure ALOHA, Slotted ALOHA, CSMA, and CSMA/CD. Configure repeatable traffic experiments, observe station states and events, review measured metrics, and compare saved runs.

## Run locally

```sh
npm install
npm run dev
```

## Production build

```sh
npm run build
npm run preview
```

## Frontend notes

- The simulation runs in the browser. It is an educational model, not an emulation of physical Ethernet hardware.
- Completed runs and appearance preferences are stored locally in the current browser. There is no account, cloud sync, or backend API.
- Run history is saved only after a simulation completes and the user selects **Save completed run**.
- Terms of Service and Privacy Policy routes are included, but require owner-approved legal copy before public release.
- The application uses the MACSim monochrome and cobalt visual system with system, light, and dark appearance preferences.
- IBM Plex Sans and IBM Plex Mono are bundled locally for the interface and simulation data.
