# Bingo Admin

A separate website for looking after the Bingo game. It uses the **same Firebase project** as the game,
but it is its own website with its own address. Nothing in the game links to it.

## What it does

- Lists all rooms: **Live** (arranging boards or playing), Waiting, Finished, All. Search by room code or player name.
- Shows each room's players, online status and numbers called.
- Shows every board that has been submitted, with the called numbers marked and each player's line count.
  A player who hasn't pressed "I'm ready" has no board yet, so nothing is shown for them.
- Swap two numbers on a player's board: tap one number, tap another, then press **Confirm swap**.
  **The player is told on their own screen which two numbers were swapped, and everyone in the room sees that
  an admin made a correction.** Swapping only works for rooms made by the current version of the game.
- While you have a live room open, its players see "An admin is viewing this game."
- Send a message to everyone in a room, remove a player, delete a room, and delete all finished or old waiting rooms.

## Set up (one time)

1. **Same Firebase project.** Copy `.env.example` to `.env` and paste the **same five values** you use for the game.
2. **Enable Google sign-in:** Firebase Console, Authentication, Sign-in method, Google, Enable, pick your support
   email, Save.
3. **Database rules:** this folder has the same `database.rules.json` as the game. Make sure it is the one you
   published (Realtime Database, Rules, paste, Publish).
4. Run it:

   ```bash
   npm install
   npm run dev
   ```

   Open <http://localhost:5174> and press **Sign in with Google**.
5. The first time, the page says the account has no access yet and shows your **account ID**. Add it once:
   Firebase Console, Realtime Database, **Data** tab. Add a child `admins`, and inside it a child named with
   your account ID and the value `true`. Press **Check again**.

Only accounts listed under `admins` can read or change anything. Nobody can add themselves from a website, because
that entry can only be written in the Firebase console.

## Deploy as its own website

1. Put this folder in its **own GitHub repository**.
2. Vercel: Add New, Project, import that repository, preset **Vite**.
3. Add the same five `VITE_FIREBASE_*` environment variables, then deploy. You get a separate address.
4. Firebase Console, Authentication, **Settings, Authorized domains, Add domain**: add the admin site's Vercel
   address (for example `bingo-admin.vercel.app`) so Google sign-in is allowed there.

The game and the admin site must be built from the same version of the shared files in `src/lib` and
`src/types.ts`. If you change the game's rules, copy those files across again.
