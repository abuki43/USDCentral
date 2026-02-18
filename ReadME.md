<div align="center">
  <img src="screenshots/logo.jpg" alt="USDCentral Logo" width="200" />
  <h1>USDCentral</h1>
  <p><b>Your stablecoins, simplified. No crypto-degree required.</b></p>
</div>

---

##  What is USDCentral?

USDCentral is all about making stablecoins easy for everyone. I built it because managing USDC across a dozen different chains is a headache for most people. With USDCentral, all that "chain" stuff happens in the background. You just manage your money and Earn on your stable.

**Built for the ETH Global Hackathon 2026!** 🚀

### What can you do?
- **Manage everything in one place**: No matter what chain your USDC is on, it just shows up as your balance.
- **Earn Yield**: Put your money to work.
- **Send & Move**: Send USDC to friends or move it to your other wallets without sweating about gas fees or bridge jargon.
- **Just Work**: You don't need to know how the plumbing works to use it.

---

##  A look inside

<div align="center">
  <table style="border: none;">
    <tr>
      <td width="30%"><img src="screenshots/SS_5.jpg" width="100%" alt="Dashboard" /></td>
      <td width="30%"><img src="screenshots/SS_2.jpg" width="100%" alt="Bridge" /></td>
      <td width="30%"><img src="screenshots/SS_3.jpg" width="100%" alt="Earn" /></td>
    </tr>
  </table>
</div>

<details>
<summary><b>View More Screens</b></summary>
<br />
<div align="center">
  <img src="screenshots/SS_4.jpg" width="30%" />
  <img src="screenshots/SS_1.jpg" width="30%" />
  <img src="screenshots/SS_6.jpg" width="30%" />
  <br />
  <img src="screenshots/SS_7.jpg" width="30%" />
</div>
</details>

---

##  The Tech Stuff

### Backend
- **Core**: Node.js & TypeScript
- **Wallet**: Powered by **Circle Developer Controlled Wallets** 
- **Database**: Firebase 
- **Moving Parts**: CCTP, and **LI.FI** for auto-swapping any token to USDC during deposits (only mainnet)
- **Earn** : Curve Finanace

### Mobile
- **Frame**: React Native (Expo) 

---

##  What's Next?
- **On-ramp & Off-ramp**: Making it possible to buy USDC with your bank account and withdraw it back to real-world cash directly in the app.


---

##  Want to run it?

1.  **Clone the repo**
2.  **Backend Setup**:
    - `cd backend`
    - Copy `.env.example` to `.env` and fill in your Circle and Firebase credentials.
    - `npm install && npm run dev`
3.  **Webhook Setup (Important!)**:
    - Use **ngrok** to tunnel your local backend port (usually 3000): `ngrok http 3000`.
    - Copy your ngrok URL and add it as the Webhook URL in your **Circle Console Dashboard**.
4.  **Mobile Setup**:
    - `cd mobile-app`
    - `npm install`
    - `npx expo start`
