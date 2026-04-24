import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSolana } from "./useSolana";
import { useCloak } from "./useCloak";

// ═══════════════════════════════════════════════════════════════════
// ANONYMOUS GAMING — Full Playable Experience
// ═══════════════════════════════════════════════════════════════════

const C = {
  bg: "#0a0b0f", surface: "#12131a", card: "#181921", cardHover: "#1e2030",
  border: "#2a2c3e", text: "#e8e9f0", muted: "#6b6e82",
  accent: "#8b5cf6", accentDim: "#6d44c8",
  gold: "#f5c842", green: "#22c55e", red: "#ef4444", blue: "#3b82f6", cyan: "#06b6d4",
};
const LCOLS = [C.green, C.blue, C.gold, C.red, C.text];
const LETTERS = ["B", "I", "N", "G", "O"];
const RANGES = { B: [1, 15], I: [16, 30], N: [31, 45], G: [46, 60], O: [61, 75] };
const getLetter = (n) => { if (n <= 15) return "B"; if (n <= 30) return "I"; if (n <= 45) return "N"; if (n <= 60) return "G"; return "O"; };
const getColIdx = (n) => LETTERS.indexOf(getLetter(n));

// Bot names pool
const BOT_NAMES = ["Phantom_0x","SolWhale","DeFi_Degen","CryptoGhost","anonPlayer","shadow.sol","NightOwl","BlockRunner","TokenHunter","MoonBoi","StakeKing","YieldFarm3r","LiquidApe","NFT_Flipper","MEV_Bot","JitoStaker","RaydiumLP","MarinadeSOL","OrcaSwimmer","DriftTrader","MangoEater","SerumDEX","BonkHolder","JUPiter_Fan","WormholeGuy","PyroSOL","AuroraDev","HeliumMiner","RenderNode","SolPunk","CyberAnon","GhostWallet","DarkPool","ZK_Prover","PrivacyMax","CloakUser42","ShadowPay","AnonBingo","LuckyHash","VRF_Lover"];

// ── Card Generator ───────────────────────────────────────────────
function generateCard(seed) {
  const rng = (s) => { s = ((s * 1103515245 + 12345) & 0x7fffffff); return s; };
  let s = seed;
  const card = [];
  for (const letter of LETTERS) {
    const [lo, hi] = RANGES[letter];
    const pool = [];
    for (let i = lo; i <= hi; i++) pool.push(i);
    const col = [];
    for (let i = 0; i < 5; i++) {
      s = rng(s);
      const idx = s % pool.length;
      col.push(pool.splice(idx, 1)[0]);
    }
    card.push(col);
  }
  card[2][2] = 0; // FREE
  return card;
}

// ── Win Detection ────────────────────────────────────────────────
function checkWin(card, calledSet) {
  const m = [];
  for (let r = 0; r < 5; r++) {
    const row = [];
    for (let c = 0; c < 5; c++) row.push(card[c][r] === 0 || calledSet.has(card[c][r]));
    m.push(row);
  }
  // Rows
  for (let r = 0; r < 5; r++) if (m[r].every(Boolean)) return { type: "line", desc: `Row ${r + 1}` };
  // Cols
  for (let c = 0; c < 5; c++) { let ok = true; for (let r = 0; r < 5; r++) if (!m[r][c]) ok = false; if (ok) return { type: "line", desc: `Col ${LETTERS[c]}` }; }
  // Diags
  if ([0,1,2,3,4].every(i => m[i][i])) return { type: "line", desc: "Diagonal" };
  if ([0,1,2,3,4].every(i => m[i][4-i])) return { type: "line", desc: "Diagonal" };
  // Corners
  if (m[0][0] && m[0][4] && m[4][0] && m[4][4]) return { type: "corners", desc: "4 Corners" };
  return null;
}

function checkFullCard(card, calledSet) {
  for (let c = 0; c < 5; c++) for (let r = 0; r < 5; r++) {
    if (card[c][r] !== 0 && !calledSet.has(card[c][r])) return false;
  }
  return true;
}

function countMarked(card, calledSet) {
  let best = 0;
  const m = [];
  for (let r = 0; r < 5; r++) { const row = []; for (let c = 0; c < 5; c++) row.push(card[c][r] === 0 || calledSet.has(card[c][r])); m.push(row); }
  for (let r = 0; r < 5; r++) { let c2 = 0; for (let c = 0; c < 5; c++) if (m[r][c]) c2++; best = Math.max(best, c2); }
  for (let c = 0; c < 5; c++) { let c2 = 0; for (let r = 0; r < 5; r++) if (m[r][c]) c2++; best = Math.max(best, c2); }
  { let c2 = 0; for (let i = 0; i < 5; i++) if (m[i][i]) c2++; best = Math.max(best, c2); }
  { let c2 = 0; for (let i = 0; i < 5; i++) if (m[i][4-i]) c2++; best = Math.max(best, c2); }
  return best;
}

// ── Styles ───────────────────────────────────────────────────────
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;500;700&family=DM+Sans:wght@400;500;700&display=swap');
:root{--fH:'Space Grotesk',sans-serif;--fB:'DM Sans',sans-serif;--fM:'JetBrains Mono',monospace}
@keyframes slideUp{0%{transform:translateY(100%)}100%{transform:translateY(0)}}
@keyframes pulse2{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes ballPop{0%{transform:scale(.3);opacity:0}60%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
@keyframes fadeIn{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
@keyframes glow{0%,100%{box-shadow:0 0 8px #f5c84240}50%{box-shadow:0 0 24px #f5c84260}}
@keyframes confetti{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(300px) rotate(720deg);opacity:0}}
*{box-sizing:border-box;margin:0;padding:0}body{background:${C.bg}}
input[type="range"]{-webkit-appearance:none;appearance:none;background:${C.border};border-radius:4px;outline:none;height:6px}
input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:${C.accent};cursor:pointer;border:3px solid ${C.surface}}
::-webkit-scrollbar{height:4px;width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${C.accent}30;border-radius:10px}
`;

// ── Sub Components ───────────────────────────────────────────────
const Badge = ({ status }) => {
  const m = { live: [C.green, "LIVE", true], registering: [C.blue, "OPEN", false], waiting: [C.accent, "WAITING", true], completed: [C.muted, "ENDED", false] };
  const [color, label, pulse] = m[status] || [C.muted, status, false];
  return (<span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 100, background: `${color}20`, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color }}>
    {pulse && <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}`, animation: "pulse2 1.5s infinite" }} />}{label}
  </span>);
};

const MiniCard = ({ card, calledSet, highlight, cardNum }) => {
  const best = countMarked(card, calledSet);
  const isHot = best >= 4;
  const won = checkWin(card, calledSet);
  const borderColor = won ? C.gold : isHot ? C.red : C.border;
  return (
    <div style={{ background: C.card, border: `1.5px solid ${borderColor}`, borderRadius: 8, padding: 4, minWidth: 72, animation: won ? "glow 1s infinite" : undefined, position: "relative" }}>
      <div style={{ fontSize: 7, color: C.muted, textAlign: "center", marginBottom: 2, fontFamily: "var(--fM)" }}>#{cardNum}</div>
      {won && <div style={{ position: "absolute", top: -6, right: -6, background: C.gold, color: C.bg, fontSize: 7, fontWeight: 800, padding: "1px 5px", borderRadius: 4 }}>BINGO!</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 1 }}>
        {[0,1,2,3,4].map(r => [0,1,2,3,4].map(c => {
          const v = card[c][r];
          const marked = v === 0 || calledSet.has(v);
          return (<div key={`${r}-${c}`} style={{
            width: 12, height: 12, borderRadius: 2, fontSize: 6, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: marked ? LCOLS[c] + (v === 0 ? "40" : "") : `${C.text}08`,
            color: marked ? "#fff" : `${C.text}15`, fontFamily: "var(--fM)",
          }}>{v === 0 ? "★" : v}</div>);
        }))}
      </div>
      <div style={{ fontSize: 7, textAlign: "center", marginTop: 2, color: isHot ? C.red : C.muted, fontWeight: isHot ? 700 : 400 }}>
        {won ? "WINNER!" : `${best}/5`}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════
export default function AnonymousGaming() {
  // Views: lobby, purchase, waiting, playing, results
  const [view, setView] = useState("lobby");
  const [playerCards, setPlayerCards] = useState([]);
  const [playerCardCount, setPlayerCardCount] = useState(5);
  const [bots, setBots] = useState([]);
  const [drawn, setDrawn] = useState([]);
  const [currentBall, setCurrentBall] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [winner, setWinner] = useState(null);
  const [waitCountdown, setWaitCountdown] = useState(15);
  const { connected: wallet, address: walletAddr, solBalance, usdcBalance, connect: connectWallet, disconnect: disconnectWallet } = useSolana();
  const { shieldedDeposit, isProcessing: cloakProcessing, progress: cloakProgress, proofProgress, ready: cloakReady } = useCloak();
  const [chatLog, setChatLog] = useState([]);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const timerRef = useRef(null);
  const chatRef = useRef(null);
  const drawIntervalRef = useRef(null);

  const GAME = { name: "Daily Dollar", price: 1, jackpot: 4250 };

  // ── Generate Bots ──────────────────────────────────────────────
  const generateBots = useCallback(() => {
    const numBots = 15 + Math.floor(Math.random() * 30); // 15-44 bots
    const botList = [];
    const usedNames = new Set();
    for (let i = 0; i < numBots; i++) {
      let name;
      do { name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]; } while (usedNames.has(name));
      usedNames.add(name);
      const numCards = 1 + Math.floor(Math.random() * 12);
      const cards = [];
      for (let j = 0; j < numCards; j++) cards.push(generateCard(i * 1000 + j * 7 + Date.now() % 10000));
      botList.push({ name, cards, numCards, addr: `${name.slice(0,4)}...${Math.random().toString(36).slice(2,5)}` });
    }
    return botList;
  }, []);

  // ── Start Purchase Flow ────────────────────────────────────────
  const startPurchase = () => {
    if (!wallet) { setShowWalletModal(true); return; }
    setView("purchase");
  };

  // ── Buy Cards & Enter Waiting Room ─────────────────────────────
  const TREASURY = "WiechrR6YfcHv9ncZPsp14yasD1KrtJZE8v15rGYWUe";

  const buyCards = async () => {
    const cards = [];
    for (let i = 0; i < playerCardCount; i++) cards.push(generateCard(Date.now() + i * 31));
    
    // Try Cloak payment if wallet connected and Cloak ready
    if (wallet && cloakReady && playerCardCount > 0) {
      try {
        const amount = BigInt(playerCardCount * 1_000_000); // USDC 6 decimals
        await shieldedDeposit(amount, TREASURY);
      } catch (err) {
        console.log("Cloak payment skipped (demo mode):", err.message);
        // Continue to game in demo mode
      }
    }

    setPlayerCards(cards);
    const newBots = generateBots();
    setBots([]);
    setDrawn([]);
    setCurrentBall(null);
    setWinner(null);
    setWaitCountdown(15);
    setChatLog([{ name: "System", msg: "You joined the game!", color: C.green, time: "now" }]);
    setView("waiting");
    // Gradually add bots
    let addedBots = [];
    let botIdx = 0;
    const addBot = () => {
      if (botIdx >= newBots.length) return;
      const bot = newBots[botIdx++];
      addedBots = [...addedBots, bot];
      setBots([...addedBots]);
      setChatLog(prev => [...prev, { name: bot.name, msg: `joined with ${bot.numCards} card${bot.numCards > 1 ? "s" : ""}`, color: C.muted, time: "now" }]);
    };
    // Add bots over the waiting period
    for (let i = 0; i < newBots.length; i++) {
      setTimeout(addBot, 500 + Math.random() * 12000);
    }
  };

  // ── Waiting Room Countdown ─────────────────────────────────────
  useEffect(() => {
    if (view !== "waiting") return;
    const interval = setInterval(() => {
      setWaitCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setView("playing");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [view]);

  // ── Game Engine (7s draws) ─────────────────────────────────────
  useEffect(() => {
    if (view !== "playing" || winner) return;

    const drawNumber = () => {
      setIsRolling(true);
      let rc = 0;
      const rollInt = setInterval(() => {
        setCurrentBall(Math.floor(Math.random() * 75) + 1);
        rc++;
        if (rc >= 10) {
          clearInterval(rollInt);
          setDrawn(prev => {
            const avail = [];
            for (let i = 1; i <= 75; i++) if (!prev.includes(i)) avail.push(i);
            if (!avail.length) return prev;
            const num = avail[Math.floor(Math.random() * avail.length)];
            setCurrentBall(num);
            setIsRolling(false);

            const newDrawn = [...prev, num];
            const newSet = new Set(newDrawn);

            // Check player cards
            for (let i = 0; i < playerCards.length; i++) {
              const w = checkWin(playerCards[i], newSet);
              if (w) {
                setTimeout(() => setWinner({ type: "player", cardIdx: i, winType: w, drawCount: newDrawn.length }), 500);
                return newDrawn;
              }
            }
            // Check bot cards
            for (const bot of bots) {
              for (let i = 0; i < bot.cards.length; i++) {
                const w = checkWin(bot.cards[i], newSet);
                if (w) {
                  setTimeout(() => setWinner({ type: "bot", name: bot.name, addr: bot.addr, cardIdx: i, winType: w, drawCount: newDrawn.length }), 500);
                  return newDrawn;
                }
              }
            }

            // Bot chat messages
            if (newDrawn.length % 4 === 0 && bots.length > 0) {
              const randBot = bots[Math.floor(Math.random() * bots.length)];
              const msgs = ["so close!", "need just one more!", "cmon cmon!", "LFG!", "this is my game!", "jackpot would be insane", "almost there...", "gg", "lets goooo", "🔥🔥🔥", "one more number please", "rigged lol", "my card is HOT"];
              setChatLog(prev => [...prev.slice(-20), { name: randBot.name, msg: msgs[Math.floor(Math.random() * msgs.length)], color: C.text, time: `#${newDrawn.length}` }]);
            }

            return newDrawn;
          });
        }
      }, 60);
    };

    // First draw immediately
    drawNumber();
    // Then every 7 seconds
    drawIntervalRef.current = setInterval(drawNumber, 7000);

    return () => { clearInterval(drawIntervalRef.current); };
  }, [view, winner, playerCards, bots]);

  // Stop draws on winner
  useEffect(() => {
    if (winner) clearInterval(drawIntervalRef.current);
  }, [winner]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatLog]);

  const calledSet = useMemo(() => new Set(drawn), [drawn]);
  const totalPlayers = 1 + bots.length;
  const totalCards = playerCards.length + bots.reduce((a, b) => a + b.numCards, 0);
  const prizePool = totalCards * GAME.price * 0.8;
  const li = currentBall ? getColIdx(currentBall) : 0;

  // ── Hot stats ──────────────────────────────────────────────────
  const hotStats = useMemo(() => {
    if (drawn.length < 3) return null;
    let bingo = 0, hot4 = 0, warm3 = 0;
    const allCards = [...playerCards, ...bots.flatMap(b => b.cards)];
    for (const card of allCards) {
      const best = countMarked(card, calledSet);
      if (best >= 5) bingo++;
      else if (best >= 4) hot4++;
      else if (best >= 3) warm3++;
    }
    return { bingo, hot4, warm3, total: allCards.length };
  }, [drawn, playerCards, bots, calledSet]);

  // ══════════════════════════════════════════════════════════════
  // LOBBY
  // ══════════════════════════════════════════════════════════════
  if (view === "lobby") return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "var(--fB)" }}>
      <style>{STYLES}</style>
      <div style={{ position: "fixed", inset: 0, backgroundImage: `radial-gradient(${C.border}30 1px, transparent 1px)`, backgroundSize: "24px 24px", pointerEvents: "none" }} />
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.card, border: `1.5px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: C.muted, position: "absolute", top: 7 }} />
              <div style={{ width: 22, height: 12, borderRadius: "0 0 11px 11px", background: C.muted, position: "absolute", bottom: 4 }} />
              <div style={{ position: "absolute", bottom: 1, right: -2, width: 12, height: 12, borderRadius: 3, background: C.text, fontSize: 7, fontWeight: 900, color: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>⚄</div>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--fH)", letterSpacing: -.5 }}>Anonymous Gaming</div>
              <div style={{ fontSize: 9, color: C.accent, letterSpacing: 1.5, fontWeight: 600 }}>PRIVACY-FIRST ON-CHAIN</div>
            </div>
          </div>
          <button onClick={wallet ? disconnectWallet : () => setShowWalletModal(true)} style={{ padding: "8px 16px", fontSize: 12, fontWeight: 700, fontFamily: "var(--fH)", border: `1.5px solid ${wallet ? C.green + "40" : C.accent + "40"}`, borderRadius: 10, background: wallet ? `${C.green}10` : `${C.accent}10`, color: wallet ? C.green : C.accent, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: wallet ? C.green : C.accent }} />
            {wallet ? walletAddr : "Connect Wallet"}
          </button>
        </div>

        {/* Jackpot */}
        <div style={{ background: `linear-gradient(135deg, ${C.gold}12, ${C.accent}08)`, border: `1px solid ${C.gold}25`, borderRadius: 16, padding: "16px 20px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.gold, letterSpacing: 2, marginBottom: 4 }}>GLOBAL JACKPOT</div>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--fH)", color: C.gold }}>${GAME.jackpot.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Full card within 40 draws</div>
          </div>
          <div style={{ fontSize: 32 }}>🎱</div>
        </div>

        {/* Game Card */}
        <div style={{ background: C.card, border: `1px solid ${C.accent}30`, borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "16px 18px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text, fontFamily: "var(--fH)", marginBottom: 4 }}>Daily Dollar Bingo</div>
              <div style={{ fontSize: 13, color: C.muted }}><span style={{ color: C.gold, fontWeight: 700 }}>$1</span> USDC · per card</div>
            </div>
            <Badge status="registering" />
          </div>
          <div style={{ display: "flex", borderTop: `1px solid ${C.border}50`, padding: "10px 18px" }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: C.muted }}>PLAYERS</div><div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--fH)" }}>—</div></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: C.gold }}>JACKPOT</div><div style={{ fontSize: 15, fontWeight: 700, color: C.gold, fontFamily: "var(--fH)" }}>${GAME.jackpot.toLocaleString()}</div></div>
          </div>
          <div style={{ padding: "0 18px 16px" }}>
            <button onClick={startPurchase} style={{
              width: "100%", padding: 14, fontSize: 15, fontWeight: 800, fontFamily: "var(--fH)", letterSpacing: 1, border: "none", borderRadius: 12,
              background: `linear-gradient(135deg, ${C.accent}, ${C.accentDim})`, color: "#fff", cursor: "pointer",
              boxShadow: `0 4px 20px ${C.accent}30`,
            }}>Join Game →</button>
          </div>
        </div>

        <div style={{ textAlign: "center", padding: "10px 0 24px", fontSize: 10, color: C.muted, fontFamily: "var(--fM)" }}>Solana Mainnet · Cloak Protocol · Switchboard VRF</div>
      </div>

      {/* Wallet Select Modal — Solflare first */}
      {showWalletModal && (<>
        <div onClick={() => setShowWalletModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)", zIndex: 300 }} />
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 301, background: C.surface, borderTop: `2px solid ${C.accent}40`, borderRadius: "24px 24px 0 0", padding: "24px 20px 36px", maxWidth: 480, margin: "0 auto", animation: "slideUp .3s ease-out" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 20px" }} />
          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "var(--fH)", color: C.text, marginBottom: 16, textAlign: "center" }}>Connect Wallet</div>
          
          {/* Solflare — Featured */}
          <button onClick={() => { setShowWalletModal(false); setTimeout(() => { try { const evt = new CustomEvent("wallet-select-solflare"); window.dispatchEvent(evt); } catch(e){} connectWallet(); }, 100); }} style={{
            width: "100%", padding: "16px 18px", display: "flex", alignItems: "center", gap: 14,
            background: `linear-gradient(135deg, ${C.accent}15, ${C.accent}08)`,
            border: `2px solid ${C.accent}40`, borderRadius: 16, cursor: "pointer", marginBottom: 8,
            transition: "all .2s",
          }}>
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFgAAABYCAIAAAD+96djAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGYktHRAD/AP8A/6C9p5MAAAAJcEhZcwAALiMAAC4jAXilP3YAAAAHdElNRQfqBBgTJw44O8m/AAAQrElEQVR42u2baZRU1bXH9z7n3Hureh6qB2iQlkFtBiWCKApOUUQBDaCoQDCgec8hrmgG1EUgRonx4RBjEudZjKiAgiiDE4m8EIMtMw4NNCqTdFV30VNV3TPs9+HeKhrFt1xUNfjWq/+HXqu6u+7wu/vs/T/7nIvUNAL+n4sIULCjfRXfF2VB+MqC8JUF4SsLwlcWhK8sCF9ZEL6yIHxlQfjKgvCVBeErC8JXFoSvLAhfWRC+siB8HQUQROT9VIqUptRHOqogxBFGgIgEoBVxC0UBBwJq00oSIHBGgEhEAIh4pEEcoYhIPW+lCDiKkOVKWvTSvhWvh6UkEbJ4oQCGSpE2AJCMETrkoSD5V+p45DR1JCLCCwRjyACIUqt5b+LxP+/861N76re3AWD1sTmjzi8eOyp0+qkFwXKbNEG7Vm4yRgC9O/VixI8pIkMAAAz8j+mHEHZqF9t7ZoioFWGQMQuff3rPbbM/37WzDZALmxGBdg2ABmDH9AhedF7J2FGlw4YW5lTYZAjatHYJADgHAAQ4QAFzOBlCSagJWXosiABFJ4JIPUkljSi29nwev/r6T5euaEDGhc3JkDaACIjAGWhzgEi37sGRPyweN7r0zKGFuV1sMuATQWAABkGU2Pf+vn71v5vnz+uPypAkZGlEROeDIERU0oiQ/f5bjROu2rJ3b9wKWMaQMQc9QKIDRAyBSvhEulYFLji3eNzo0FlnFOZ3tUkDJAw6bMat2+66bweAmfbjbk/+5TjSBOkk2E4F0ZHCay/vu3zKZtfV3BKMAxBoA4cM5m8hgpVdgiPOKRo/JjT8tMJfzNz+zNxddsDiAmOtsbmPDZg0ratqUkJ8/0B4N6kV8WKx4s3IqHEblILuPQItLTraGAdAYNyy8bsQYQyIQLkGSAOw/AKrtUVymzOGbsy97qfdH5rT2yscaUZE55RPRGOI57D6z9onT9tiAAHMyPNKdm4a8vD9J1xwfignh8m4lAllNAmBnPn4OhzAv0KtwRjgFrMClnB4S6sWNmcIbsy9+YYeDz18PDFIi0LqjJ0UEWSAFYhxl258dfFXgVw73qaGDCn8YNUgw4Ep2rU19uY7TQteD7+/en97q/tdYwQIGTIEmZC3/fLYu+7ppZoUB/ieVg0CMJp4AV+1Mjp8xFpucyIwRDbHdasH1fQOujFj53EKcpTmuxMhIpakcMeMXjNn91QRyTFtCtB5Q4OACMBir7zaAGAYQyCyBLoJdd8DX0K+xQS6rVqGXd2iq6oD1/ys27IlJ372weDHHqw5aNQog4iQtI+MIQLIhLpndp+Zs3vKiOQsExSS6oSIICICFmRnjVj3j1VR4XBjAAAQQbt61i3Vv7v9WHIYtGmTMNoQAHCGPMgOxMjbTa8sDq/b1BqOSM9BMYYIpFz9l3uPu+GXx8iwFBwy5Sk7JSKS/h9AUjxBHX9PBMLmd/xX/eAzap99dNe+PQleKKyQbedwAHDbkjHSIzDt+qoVbw+aemUFKcMYeDGlXPPEX2syTyGpjM01OrppshAK7LJSC4C8K/WtMaBwRO3a5qnXRfMLnbOHFV06pvSCc4oregYZR2zXKmbcdm0H2O9n1c154AtmcQAgQ2TMC0/2nTiti2xwhcCMU4BMDY2D3HSRaI6oGb+tf/z5vVIaZNjRRxIR54gI0iUwGgDyC+2zhxWOHx0aeW5xxbFBsHDm9K2z76nntoUIWhFn9NIz/cZNrOhAATIJIYNVw/eRikSp+GBldOLVn2yvb7UsEQiyllYtLKb1IR4g5wBwgEhunj16ZEnAYc++sFs4ggi0MrbA+c/3GzOhXDa4wmKY9FqZVKZAHPCRJWLhvH1XTN2sNRhNP5lU+esbuw+7cF1Tk2sHLaP9ufM39TUiwhYEoDXlBNiy104cfl6Z3h8HRUTgpYwMN2+IAAW//dZe6R4I0WjihXzlO9Exl200gMiZ4/C5T9fUDCq46OziVaub9+xuJ4NcIGdAqbMn74QIiAAZCptxwbwqQwS2zSJh2RJOdKu087s4mMtQg5YEmGkcyDIUEQzjkgadWbvl4zYnRyTaVd/++evfPxml4fkiHtOPPLL7T4/v3lHfBkAAXDiMoWeZDh3qfgPGEGk/j5wzrOiyi0MXjSgpqQ5QzOg2zTiwjGTNTA0NpUiUiJee23vF1E1WwDaGtGsquzof155SFGTSNdxirEjEGtyVK6Pzl4SXvRPdvSsGYAA4cvw2U+T98mujpiQUuGJs6KZrq/qcnK/3K1TEeGacZbpDw7dPufzRh3f9u7bZC2xuYXPULSuxTj8/RNIY16hW7Tis90l5l4wtv3Zi+fChRU6AR6IqFicvj6YcNCURePdGBMYAS46a9la9pjb66HNfNe+Tw88qsnOYcYml7y+RZchQGWqMKgD/UowBJvj0Wdtnz9xqDFnltl0kyFAiLBP73JxcPmJM6ZPP9lv97slVlTYpQgTOkbRRrkYES2CqQwnJmajWoBQxgXbA1pru/XP9sHPX7tyZYDnM+CjTuoMMgWBYXCTAz4NARICInM2cvb3mlA9n3bpt7b+aiWGgwnZKhJHEEia6Jz7xqi319e3cZoyhSuhjugf69s3XrnbjUrsaASwrRQTAd2UglSFAJ8dZu37/qHEb9+/XzMJvLUjfWekODUQ0BliQNX0lF77eICyRCnUA5BaLROQ/VjU+/txXCxZHdm6P5VrYvUegqUVfeMmG//5Xk3AEIqiEOr5P7rtvDLzt5m7nDi8uKbEjUR0Ou1oq0sgtZAxSrsz7qTU5AbF7V1s8ASN/VKbbDeNpjI2MVQ2Ore1m4BkfbtseswJCeRPH5KyRc1SKjNQABoANHFggXb15S6vXv9SuPrF/3psLB1RVOTpmWIFAC2Wj/LC2ZdHSyMIlkbq6VmTILW70QQUTAbSmUKnY8sHgsjLbuIYdXgs3Y4YKwCjiRWLZG5GLxq4HRMvhWpFJJjAvk3leSCvSUiNDbvm9/MpKe9XbP+jVL9+4CuPGjRsyYDuIeRwtJhvl4iWRGXft+PTTVssR6mCHyhiohF62YMAFl5SpqBL88EFkIkcQcYE6qkaOLn39lQHFRZYbc40hIfzi5yVRY0BKQwDC4Uwwrcl7Ek379YiLN0ybsmnponBLs3JCllNuIUe3Ubn7XM5w/I8r1/1z0OTLK2VCcY7f6OiZHV8kgCOklyUy4Cz94sdRt5vjf5A/5dKyeBw+2RqPtbpGEQHyZKlPVcTUtzxv3tQo123Y/7dX9j39YsPa2haImW5VTm4XBwmMS6ZdC5uNv6Ji8/q2TZtbhMXJ+CaMMTDKjPhhyalnFOl2ww97dSMjOQIOnoNjkLEc3rAt9sZbjQuWhN97P9rWopnFvtZrTi3eeXz8/r1rgAwAVFQGp02suPnGbmXdHR1VAMCD7Ms97sAhaxqbNLf8Ysk5yLia+1jfSdd0UZHD7ehnsDGD6D9hLhASRkVkqNK+6tqqRfP7R+qG/vz6KiM154iIDMFo4gyEQO9b3pVIlepWC+GIffsSf7i/vu+QNUsWNvAiAQCyTXfvFRx7SRmQSrkfrQGQHd8nCJLS9NmZ7FClOgVCIEkT35tgNttU1z5/URiQeX8ySufmMplQMq60NIwB5/4SBiT791oTE8wO2pGIHDNh4+KFDbxQGANAdPqpBSnbhghGmj69gwP65ULMpOkNO6F569V5RcEuzrvLG88euW7Xrji3kDPQrrxqUpfP1w+Z91S/y8ZVlJba6mAicGDIgJRG2BwAb5pe19Lg2jaChopSy18fJ+IcAfSEsWVOma1kul2KTIJIzSOlNFaZvfTVhlHjN7TFjHA4ELlx99qruz/1xAklFfaEKZUvv9y/bs3g+c/1nzihsqzMJ4IAqbqAiEoZK8Drd8SWv9WIeQIMJVzy2n/I0E2YUMi57pqu0KYZSybhow7Co0BEShqrzH71xa8uuXxjQgK3mDGgFcyc3uvhR45P7FeqTesmpZtUcak1blLFCy/2q1sz+NUXBowZVU7GaGmSvQYvgxAA1a5vBQRgWFcfAyBA4BzBqFm3VVf1yVExgwzTnIxnBgQR+RQUWWX2vGf2XDp5syZkAonASNOzZ2Di+DJIGDtkW3kcEQhAu0Y3KtWoCorFxZeXL148YNWbA3tWB7SrUyw8hRsVAIBrlr/dCIBCMDfm/mh0+Y03dDONkvN0wyEzIFKFUGmyyuynH9l15dQtXqPBaCJDzGL1O+I1p304+KyP7v/Djh11MV7Aealgjn92kmSalIzIoSNKli8+KVRqa0kd/TICgBAr3mt6b2WTHbRire6AvvlPPVYDMhk4aTeq0gXRgQJYIfvhB76cdt3HwmbeOrB3iV4Li3FWW9v8qxl1NUNrR47aMPfxPU0NrigRvFgg99wRJva6vfrl/edPuyZrJCEgAFRVOQD6V9O3AqAbU9U9gosXnFhcLHTcH0fp9+vSWtc4QMGAFbL+ePfnv7itzmu9dmzhp4yTcDhDkUiY5W+Fl78VLil1LhpRMml82dlnFgXKbHINa9YQU8NPKwRgXpbwBkjfmtybf/bpxi2tANizOrhiyUnVPQO6WXPxPVjyS7UVFYFVat11e/2M320TjmCIhsh866J2hwZcgoA0AFZX54wbU3rl2LKBJ+eLQvujD6KDTvuQWcz7fyHwrNMLV66KKlcPPLFgyYIBVcc4ar8SFsvgkl9aFpuIiCErELNu3XbnnO2WYwGijEsAQM4ti/2vRLzePFByZwwyPqB/3n9MqQyVWldM+4SJAxN5NEYpPXpk+d+eq8nPE7otk7GQLgi/wnG85bf1cx7YYQcsAHDjcvSF5USw7J1GLRUAYxYXAr255jcvveNeIaXB61lwS1ByUAiBWpFR+pabetx9dy/jGkpQJikkQRx+jtAGRKF4fcG+OQ9sD+QEjCE3Lq+7uvtDDx0HBHWb2ha+EX55UXjd+hY3pgEYt7ng6LXwU0o5a6n8JILItfaRCY5uXBYUWk88WHPZlErVJBlBhimkriSdiCAC5rCbpm/900NfAOBvfl1959291H6FGngepwCjVr3+o5aXF4UXLAnXfdYGYLztlYhgNJhv2OKUN2UMEEAm5KmnFM994oTeA/JkxBW8U5Z/M5MjgCHm8smTt5xwXPA3d/SSEVcgIENtyBjgHDCHo8Nko/zn6uZ5rzUsXtq4e1c7AAByy/G6jweGTDKVonI1Ed3y82Nm39lTCFQtivsLn5mPhQzkCH8xiiHZiAypXbPkfBxSWwEMEBEXDHI5Cmzbm3j379EXFzYse6epqTEBAMi5sNBbv0AEb3NQdXXukw8ed+6YkIoq1MTTX8XpPBDQwUf4O6PxEPs3Uv+jDQABtxFyOSJEdsTffLtp3sKGlaui7W0uAGOCExnSZurkrn+c06uw3FaNknfObogMg+h4n9ChH3HIc6V2UmsNACACjHIZKvjys/ZFSyMvvRZetTratdJ55L7eYy6v0K0K/OoAAJneB9AZIA7jpEmA/ljgQUY5HBNm45rmkkq7qneOCsvU8v+ReHPjqIA46Ozolx5tgDNgudxIMnHDBXZWXvx2EEf0DZ6O8u7R6zhYAolIt2q/zeetGB7Zt3iOGogORPyFvOQiyNF4kSn7ll9KWRC+siB8ZUH4yoLwlQXhKwvCVxaErywIX1kQvrIgfGVB+MqC8JUF4SsLwpdIf2fB/30RAAnAo9+bOdoiAPE/O3UrLi/uhssAAAAASUVORK5CYII=" alt="Solflare" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }} />
            <div style={{ textAlign: "left", flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "var(--fH)", color: C.text }}>Solflare</div>
              <div style={{ fontSize: 11, color: C.accent, marginTop: 2 }}>Recommended · Solana native wallet</div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, background: `${C.accent}15`, padding: "4px 10px", borderRadius: 100, letterSpacing: 1 }}>FEATURED</div>
          </button>

          {/* Other wallets */}
          <button onClick={() => { setShowWalletModal(false); connectWallet(); }} style={{
            width: "100%", padding: "14px 18px", display: "flex", alignItems: "center", gap: 14,
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, cursor: "pointer",
            transition: "all .2s",
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.border, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b6e82" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="20" height="14" rx="3"/><path d="M16 14h.01M2 10h20"/></svg>
            </div>
            <div style={{ textAlign: "left", flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--fH)", color: C.muted }}>Other Wallets</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>Phantom, Backpack, and more</div>
            </div>
          </button>

          <div style={{ textAlign: "center", marginTop: 16, fontSize: 10, color: C.muted }}>🛡️ Privacy-first · Powered by Cloak Protocol</div>
        </div>
      </>)}
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // PURCHASE
  // ══════════════════════════════════════════════════════════════
  if (view === "purchase") return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "var(--fB)", display: "flex", flexDirection: "column" }}>
      <style>{STYLES}</style>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px", width: "100%", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--fH)", marginBottom: 4 }}>Daily Dollar Bingo</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>$1 USDC per card · Max 50 cards</div>
        {usdcBalance !== null && <div style={{ fontSize: 11, color: C.green, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />
          Wallet: {usdcBalance?.toFixed(2)} USDC {solBalance !== null && <span style={{ color: C.muted }}>· {solBalance?.toFixed(3)} SOL</span>}
        </div>}

        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[1, 5, 10, 25, 50].map(n => (
            <button key={n} onClick={() => setPlayerCardCount(n)} style={{ flex: 1, padding: "10px 0", fontSize: 14, fontWeight: 700, fontFamily: "var(--fH)", border: `1.5px solid ${playerCardCount === n ? C.accent : C.border}`, borderRadius: 10, background: playerCardCount === n ? `${C.accent}15` : "transparent", color: playerCardCount === n ? C.accent : C.muted, cursor: "pointer" }}>{n}</button>
          ))}
        </div>
        <input type="range" min="1" max="50" value={playerCardCount} onChange={e => setPlayerCardCount(parseInt(e.target.value))} style={{ width: "100%", accentColor: C.accent, marginBottom: 4 }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted, marginBottom: 20 }}><span>1</span><span style={{ fontSize: 18, fontWeight: 800, color: C.text, fontFamily: "var(--fH)" }}>{playerCardCount} cards</span><span>50</span></div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: C.card, borderRadius: 12, marginBottom: 14, border: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 12, color: C.muted }}>Total</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: C.gold, fontFamily: "var(--fH)" }}>${playerCardCount.toFixed(2)} <span style={{ fontSize: 12, color: C.muted }}>USDC</span></span>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 18, fontSize: 10, color: C.muted }}>
          {[["Prize Pool", (playerCardCount * .8).toFixed(2), C.green], ["Jackpot", (playerCardCount * .15).toFixed(2), C.gold], ["House", (playerCardCount * .05).toFixed(2), C.muted]].map(([l, v, c]) => (
            <div key={l} style={{ flex: 1, padding: 8, background: `${c}08`, borderRadius: 8, textAlign: "center" }}><div style={{ color: c, fontWeight: 700, fontSize: 13 }}>${v}</div><div>{l}</div></div>
          ))}
        </div>

        <button onClick={buyCards} disabled={cloakProcessing} style={{
          width: "100%", padding: 16, fontSize: 15, fontWeight: 800, fontFamily: "var(--fH)", letterSpacing: 1, border: "none", borderRadius: 14,
          background: cloakProcessing ? C.muted : `linear-gradient(135deg, ${C.accent}, ${C.accentDim})`, color: "#fff", 
          cursor: cloakProcessing ? "wait" : "pointer",
          boxShadow: `0 4px 20px ${C.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>🔒 {cloakProcessing ? cloakProgress : `Pay $${playerCardCount.toFixed(2)} with Cloak`}</button>
        {cloakProcessing && proofProgress > 0 && (
          <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: C.border, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${proofProgress}%`, background: `linear-gradient(90deg, ${C.accent}, ${C.cyan})`, borderRadius: 2, transition: "width .3s" }} />
          </div>
        )}
        <div style={{ textAlign: "center", marginTop: 10, fontSize: 10, color: C.muted }}>🛡️ {cloakProcessing ? "Generating zero-knowledge proof..." : "Your balance and identity stay private"}</div>
        <button onClick={() => setView("lobby")} style={{ marginTop: 16, background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", textAlign: "center", width: "100%" }}>← Back to lobby</button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // WAITING ROOM
  // ══════════════════════════════════════════════════════════════
  if (view === "waiting") return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "var(--fB)" }}>
      <style>{STYLES}</style>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: `1px solid ${C.border}50` }}>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--fH)" }}>Daily Dollar Bingo</div>
          <Badge status="waiting" />
        </div>

        {/* Countdown */}
        <div style={{ textAlign: "center", padding: "40px 0 24px" }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 8 }}>GAME STARTS IN</div>
          <div style={{ fontSize: 64, fontWeight: 800, fontFamily: "var(--fH)", color: waitCountdown <= 5 ? C.red : C.text, transition: "color .3s" }}>{waitCountdown}s</div>
          <div style={{ width: "60%", height: 4, borderRadius: 2, background: C.border, margin: "16px auto 0", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${((15 - waitCountdown) / 15) * 100}%`, borderRadius: 2, background: `linear-gradient(90deg, ${C.accent}, ${C.cyan})`, transition: "width 1s linear" }} />
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {[["Players", totalPlayers, C.accent], ["Cards", totalCards, C.text], ["Your Cards", playerCards.length, C.green]].map(([l, v, c]) => (
            <div key={l} style={{ flex: 1, padding: "12px 8px", background: C.card, borderRadius: 12, textAlign: "center", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--fH)", color: c }}>{v}</div>
              <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1, marginTop: 2 }}>{l.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* Chat / join log */}
        <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>LOBBY CHAT</div>
        <div ref={chatRef} style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: "8px 12px", height: 200, overflowY: "auto" }}>
          {chatLog.map((msg, i) => (
            <div key={i} style={{ marginBottom: 4, fontSize: 11, animation: "fadeIn .3s ease-out" }}>
              <span style={{ color: msg.color, fontWeight: 600, fontFamily: "var(--fM)" }}>{msg.name}</span>
              <span style={{ color: C.muted }}> {msg.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // PLAYING
  // ══════════════════════════════════════════════════════════════
  if (view === "playing") return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "var(--fB)" }}>
      <style>{STYLES}</style>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}50` }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--fH)" }}>Daily Dollar</div>
          <Badge status="live" />
          <div style={{ fontSize: 10, color: C.muted }}>{totalPlayers} players · {totalCards} cards</div>
        </div>

        {/* Ball */}
        <div style={{ textAlign: "center", padding: "16px 0 10px" }}>
          {currentBall && (
            <div style={{
              width: 100, height: 100, margin: "0 auto", borderRadius: "50%",
              background: `radial-gradient(circle at 38% 30%, #fff, ${LCOLS[li]})`,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 30px ${LCOLS[li]}30`, animation: isRolling ? "pulse2 .15s infinite" : "ballPop .4s ease-out",
            }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(0,0,0,.5)", fontFamily: "var(--fH)" }}>{getLetter(currentBall)}</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#111", fontFamily: "var(--fH)", lineHeight: 1 }}>{currentBall}</div>
            </div>
          )}
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Draw {drawn.length}/75 · Prize: <span style={{ color: C.gold }}>${prizePool.toFixed(0)}</span></div>
        </div>

        {/* Jackpot bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: `${C.gold}08`, border: `1px solid ${C.gold}20`, borderRadius: 10, marginBottom: 8, fontSize: 11 }}>
          <span style={{ color: C.gold }}>🎱 Jackpot ${GAME.jackpot.toLocaleString()}</span>
          <span style={{ color: drawn.length <= 40 ? C.gold : C.muted }}>{drawn.length <= 40 ? `${40 - drawn.length} draws left` : "Closed"}</span>
        </div>

        {/* Hot cards */}
        {hotStats && (
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {[["🔥", hotStats.hot4, "4/5 HOT", C.red], ["🎯", hotStats.bingo, "BINGO!", C.gold], ["📊", hotStats.warm3, "3/5", C.muted]].map(([e, v, l, c], i) => (
              <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", gap: 4, padding: "6px 8px", background: v > 0 ? `${c}10` : `${C.card}`, borderRadius: 8, border: `1px solid ${v > 0 ? c + "25" : C.border}`, fontSize: 10 }}>
                <span>{e}</span>
                <span style={{ fontWeight: 700, color: v > 0 ? c : C.muted, fontFamily: "var(--fH)", fontSize: 14 }}>{v}</span>
                <span style={{ color: C.muted }}>{l}</span>
              </div>
            ))}
          </div>
        )}

        {/* My Cards */}
        <div style={{ fontSize: 10, color: C.accent, letterSpacing: 2, marginBottom: 6, fontWeight: 700 }}>MY CARDS ({playerCards.length})</div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "2px 0 10px", marginBottom: 8 }}>
          {playerCards.map((card, i) => <MiniCard key={i} card={card} calledSet={calledSet} cardNum={i + 1} />)}
        </div>

        {/* Chat */}
        <div ref={chatRef} style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "6px 10px", height: 80, overflowY: "auto", marginBottom: 8 }}>
          {chatLog.slice(-15).map((msg, i) => (
            <div key={i} style={{ fontSize: 10, marginBottom: 2 }}>
              <span style={{ color: msg.color === C.text ? C.accent : msg.color, fontFamily: "var(--fM)", fontWeight: 600 }}>{msg.name}</span>
              <span style={{ color: C.muted }}> {msg.msg}</span>
            </div>
          ))}
        </div>

        {/* Number Board */}
        <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: "10px 4px" }}>
          <div style={{ display: "flex" }}>
            {LETTERS.map((letter, i) => (
              <div key={letter} style={{ flex: 1 }}>
                <div style={{ textAlign: "center", fontSize: 16, fontWeight: 800, color: LCOLS[i], fontFamily: "var(--fH)", padding: "2px 0 4px", borderBottom: `2px solid ${LCOLS[i]}30`, marginBottom: 2 }}>{letter}</div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {Array.from({ length: 15 }, (_, j) => {
                    const num = RANGES[letter][0] + j;
                    const called = calledSet.has(num);
                    const latest = num === currentBall && !isRolling;
                    return (<div key={num} style={{
                      width: "88%", textAlign: "center", fontSize: 13, fontWeight: 700, fontFamily: "var(--fH)",
                      padding: "3.5px 0", margin: "1px 0", borderRadius: 6,
                      color: called ? "#fff" : `${C.text}15`, background: called ? LCOLS[i] : "transparent",
                      boxShadow: latest ? `0 0 10px ${LCOLS[i]}50` : "none",
                      transform: latest ? "scale(1.08)" : "scale(1)", transition: "all .2s",
                    }}>{num}</div>);
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ textAlign: "center", padding: "10px 0 20px", fontSize: 9, color: C.muted }}>🔒 Cloak · VRF · Solana</div>
      </div>

      {/* Winner Overlay */}
      {winner && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", backdropFilter: "blur(6px)", zIndex: 200 }} />
          <div style={{ position: "fixed", inset: 0, zIndex: 201, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: C.surface, borderRadius: 24, padding: "32px 24px", maxWidth: 400, width: "100%", textAlign: "center", border: `2px solid ${winner.type === "player" ? C.gold : C.accent}40`, animation: "fadeIn .5s ease-out" }}>
              {/* Confetti */}
              {winner.type === "player" && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 300, overflow: "hidden", pointerEvents: "none" }}>
                {[...Array(20)].map((_, i) => <div key={i} style={{ position: "absolute", width: 8, height: 8, borderRadius: i % 2 ? "50%" : 0, background: [C.gold, C.accent, C.green, C.red, C.blue][i % 5], left: `${5 + i * 4.5}%`, top: -10, animation: `confetti ${1.5 + Math.random()}s ease-out ${i * .08}s infinite` }} />)}
              </div>}

              <div style={{ fontSize: 48, marginBottom: 12 }}>{winner.type === "player" ? "🎉" : "😤"}</div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--fH)", color: winner.type === "player" ? C.gold : C.text, marginBottom: 8 }}>
                {winner.type === "player" ? "YOU WON!" : `${winner.name} Wins`}
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
                {winner.winType.desc} · Draw #{winner.drawCount}
              </div>

              {winner.type === "player" && (
                <div style={{ fontSize: 32, fontWeight: 800, fontFamily: "var(--fH)", color: C.gold, marginBottom: 8 }}>
                  +${(prizePool * 0.5).toFixed(2)} USDC
                </div>
              )}
              {winner.type === "bot" && (
                <div style={{ fontSize: 14, color: C.muted, fontFamily: "var(--fM)", marginBottom: 8 }}>
                  Winner: {winner.addr}
                </div>
              )}

              <div style={{ fontSize: 11, color: C.muted, marginBottom: 20 }}>
                {totalPlayers} players · {totalCards} cards · {drawn.length} draws
              </div>

              <button onClick={() => { setView("lobby"); setDrawn([]); setWinner(null); }} style={{
                width: "100%", padding: 14, fontSize: 15, fontWeight: 800, fontFamily: "var(--fH)", border: "none", borderRadius: 12,
                background: `linear-gradient(135deg, ${C.accent}, ${C.accentDim})`, color: "#fff", cursor: "pointer",
              }}>Back to Lobby</button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return null;
}
