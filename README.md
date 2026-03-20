# GDG Spectrum Game

A 2D pixel-art samurai fighting game built with React and Vite.

## 🚀 Setup Instructions

Follow these steps to get the game running locally on your machine.

### Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (Recommended: Node 20+, though the game works on Node 25)
- `npm` (comes with Node.js)

### 1. Install Dependencies

Clone the repository and install the required npm packages:

```bash
# Navigate to the project directory
cd gdg-spectrum-game

# Install dependencies using npm
npm install
```

### 2. Start the Development Server

Run the Vite development server:

```bash
npm run dev
```

This will start the local server. You should see output similar to this:

```
  VITE v8.0.0  ready in X ms
  ➜  Local:   http://localhost:5173/
```

### 3. Play the Game

Open your web browser and navigate to the Local URL provided in the terminal (usually `http://localhost:5173/`).

- **Warning**: Audio auto-plays dynamically on the intro screen.
- Maximize the window for the best responsive pixel-art scaling!

### Gameplay Notes

- Click to attack when the attack prompt appears.
- If you wait around 3 seconds while idle, the enemy will auto-attack.
- During enemy attacks, the hero plays a short hit reaction and then returns to a steady idle pose.

### Build for Production

If you want to build the static site for production deployment:

```bash
npm run build
```

This will compile the game into the `dist/` directory.

You can preview the built production site locally by running:

```bash
npm run preview
```

---

## Technical Stack

- **Framework**: React 18
- **Build Tool**: Vite 8
- **Styling**: Tailwind CSS & Vanilla CSS
- **Animations/Sprites**: Custom React Hooks for 2D Sprite Animation Frame pacing
