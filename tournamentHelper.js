/**
 * Free Fire Tournament App - Backend Data Helper
 * Supports:
 *  - 5 Preset Game Modes with accurate entry/reward models
 *  - UPI Transaction processing (PhonePe, GPay, BHIM, Paytm)
 *  - Automated entry-fee deduction, kill-rewards, and team prize distribution
 */

// ==========================================
// 1. GAME MODES & REWARD CONFIGURATION
// ==========================================
const TOURNAMENT_MODES = {
  SURVIVAL: {
    id: "MODE_SURVIVAL",
    name: "Survival Mode",
    entryFee: 6,
    maxPlayers: 48,
    type: "SURVIVAL",
    // Rank-based distribution pool (Customizable)
    rankRewards: {
      1: 100, // 1st Place (Booyah)
      2: 50,  // 2nd Place
      3: 30   // 3rd Place
    }
  },
  FULL_MAP_PER_KILL: {
    id: "MODE_FULL_MAP_KILL",
    name: "Full Map Per-Kill Mode",
    entryFee: 7,
    perKillReward: 6,
    maxPlayers: 48,
    type: "PER_KILL"
  },
  ONE_TAP_1V1: {
    id: "MODE_1V1_CUSTOM",
    name: "1v1 One Tap Custom",
    entryFee: 25,
    winReward: 50,
    maxPlayers: 2,
    teamSize: 1,
    type: "CLASH_SQUAD"
  },
  ONE_TAP_2V2: {
    id: "MODE_2V2_CUSTOM",
    name: "2v2 One Tap Custom",
    entryFee: 23, // Per player
    winReward: 150, // Total team win reward
    maxPlayers: 4,
    teamSize: 2,
    type: "CLASH_SQUAD"
  },
  ONE_TAP_4V4: {
    id: "MODE_4V4_CUSTOM",
    name: "4v4 One Tap Custom",
    entryFee: 30, // Per player
    winReward: 200, // Total team win reward
    maxPlayers: 8,
    teamSize: 4,
    type: "CLASH_SQUAD"
  }
};

// Supported Indian UPI Providers
const UPI_PROVIDERS = {
  GPAY: { code: "GPAY", name: "Google Pay" },
  PHONEPE: { code: "PHONEPE", name: "PhonePe" },
  BHIM: { code: "BHIM", name: "BHIM UPI" },
  PAYTM: { code: "PAYTM", name: "Paytm UPI" }
};

// ==========================================
// 2. IN-MEMORY STORAGE (Mocks DB Collections)
// Replace these with MongoDB/PostgreSQL in production
// ==========================================
const db = {
  users: new Map(),
  tournaments: new Map(),
  transactions: new Map()
};

// ==========================================
// 3. USER & WALLET HELPERS
// ==========================================

/**
 * Creates or retrieves a user profile with wallet information
 */
function createUser({ userId, username, ffUid, upiId = "" }) {
  const user = {
    userId,
    username,
    ffUid, // Free Fire UID
    wallet: {
      depositBalance: 0,   // Money added via UPI
      winningsBalance: 0,  // Money won from matches
      totalBalance: 0
    },
    upiDetails: {
      preferredApp: null, // "PHONEPE", "GPAY", "BHIM"
      upiId: upiId        // e.g. "player@okhdfcbank"
    },
    createdAt: new Date().toISOString()
  };

  db.users.set(userId, user);
  return user;
}

/**
 * Updates wallet balance and logs the UPI transaction
 */
function processUpiDeposit({ userId, amount, upiProvider, upiId, utrNumber }) {
  const user = db.users.get(userId);
  if (!user) throw new Error("User not found.");

  // Indian Banking Standard: UTR / UPI Ref Numbers are 12 digits
  const utrRegex = /^\d{12}$/;
  if (!utrRegex.test(utrNumber)) {
    throw new Error("Invalid UPI Ref / UTR number. Must be a 12-digit numeric code.");
  }

  if (!UPI_PROVIDERS[upiProvider]) {
    throw new Error(`Unsupported UPI provider. Must be one of: ${Object.keys(UPI_PROVIDERS).join(", ")}`);
  }

  // Prevent duplicate UTR usage (Fraud Prevention)
  for (const txn of db.transactions.values()) {
    if (txn.utrNumber === utrNumber) {
      throw new Error("This UTR / Transaction Reference has already been submitted.");
    }
  }

  const transactionId = "TXN_" + Date.now();
  const transactionRecord = {
    transactionId,
    userId,
    type: "DEPOSIT",
    gateway: "UPI",
    provider: upiProvider,
    upiId,
    utrNumber,
    amount: Number(amount),
    status: "SUCCESS", // Mark as PENDING if verifying via automated webhook
    timestamp: new Date().toISOString()
  };

  // Update user wallet
  user.wallet.depositBalance += Number(amount);
  user.wallet.totalBalance = user.wallet.depositBalance + user.wallet.winningsBalance;
  user.upiDetails.preferredApp = upiProvider;
  user.upiDetails.upiId = upiId;

  db.transactions.set(transactionId, transactionRecord);
  return { success: true, newBalance: user.wallet.totalBalance, transactionRecord };
}

/**
 * Deducts entry fee for a tournament
 */
function deductEntryFee(userId, amount) {
  const user = db.users.get(userId);
  if (!user) throw new Error("User not found");
  if (user.wallet.totalBalance < amount) {
    throw new Error(`Insufficient balance. Required: ₹${amount}, Available: ₹${user.wallet.totalBalance}`);
  }

  // Deduct from deposit balance first, then from winnings
  let remaining = amount;
  if (user.wallet.depositBalance >= remaining) {
    user.wallet.depositBalance -= remaining;
  } else {
    remaining -= user.wallet.depositBalance;
    user.wallet.depositBalance = 0;
    user.wallet.winningsBalance -= remaining;
  }
  user.wallet.totalBalance = user.wallet.depositBalance + user.wallet.winningsBalance;

  return true;
}

/**
 * Credits winning rewards to user's winning wallet
 */
function creditWinnings(userId, amount, reason) {
  const user = db.users.get(userId);
  if (!user) return null;

  user.wallet.winningsBalance += Number(amount);
  user.wallet.totalBalance = user.wallet.depositBalance + user.wallet.winningsBalance;

  const transactionId = "WIN_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  const txn = {
    transactionId,
    userId,
    type: "CREDIT_WINNINGS",
    amount,
    reason,
    timestamp: new Date().toISOString()
  };
  db.transactions.set(transactionId, txn);

  return user.wallet.totalBalance;
}

// ==========================================
// 4. TOURNAMENT HELPER FUNCTIONS
// ==========================================

/**
 * Create a new tournament match instance
 */
function createMatch(modeKey, customTitle = "") {
  const modeConfig = TOURNAMENT_MODES[modeKey];
  if (!modeConfig) throw new Error("Invalid match mode key.");

  const matchId = "MATCH_" + Date.now();
  const match = {
    matchId,
    title: customTitle || modeConfig.name,
    modeKey,
    config: { ...modeConfig },
    status: "UPCOMING", // UPCOMING, ONGOING, COMPLETED, CANCELLED
    roomId: null,       // Free Fire Custom Room ID
    roomPassword: null, // Free Fire Custom Room Pass
    participants: [],   // List of joined user IDs / team objects
    results: null,
    createdAt: new Date().toISOString()
  };

  db.tournaments.set(matchId, match);
  return match;
}

/**
 * Register a user or squad for a tournament
 */
function joinMatch(matchId, participantData) {
  const match = db.tournaments.get(matchId);
  if (!match) throw new Error("Match not found.");
  if (match.status !== "UPCOMING") throw new Error("Match is no longer accepting entries.");

  const { entryFee, maxPlayers, teamSize = 1 } = match.config;

  // Handle Team Entries (1v1, 2v2, 4v4)
  const players = Array.isArray(participantData.players) 
    ? participantData.players 
    : [participantData.userId];

  if (players.length !== teamSize) {
    throw new Error(`This mode requires exactly ${teamSize} player(s) per entry.`);
  }

  if (match.participants.length + players.length > maxPlayers) {
    throw new Error("Match slot full.");
  }

  // Deduct entry fee for each player
  for (const uid of players) {
    deductEntryFee(uid, entryFee);
  }

  match.participants.push({
    teamId: participantData.teamId || `TEAM_${players[0]}`,
    players: players,
    joinedAt: new Date().toISOString()
  });

  return { success: true, message: `Successfully joined match ${matchId}` };
}

/**
 * Settle match results and distribute payouts dynamically
 */
function settleMatchResults(matchId, payload) {
  const match = db.tournaments.get(matchId);
  if (!match) throw new Error("Match not found.");
  if (match.status === "COMPLETED") throw new Error("Match results already settled.");

  const { modeKey, config } = match;
  const settlementSummary = [];

  switch (modeKey) {
    // -------------------------------------------------------------------------
    // 1. SURVIVAL MODE (Rank-based prize)
    // -------------------------------------------------------------------------
    case "SURVIVAL": {
      // payload.rankings = [{ rank: 1, userId: "u1" }, { rank: 2, userId: "u2" }]
      for (const entry of payload.rankings) {
        const prize = config.rankRewards[entry.rank];
        if (prize && prize > 0) {
          creditWinnings(entry.userId, prize, `Survival Mode - Rank #${entry.rank}`);
          settlementSummary.push({ userId: entry.userId, rank: entry.rank, prize });
        }
      }
      break;
    }

    // -------------------------------------------------------------------------
    // 2. FULL MAP PER-KILL MODE (₹7 Entry, ₹6 Per Kill)
    // -------------------------------------------------------------------------
    case "FULL_MAP_PER_KILL": {
      // payload.killData = [{ userId: "u1", kills: 5 }, { userId: "u2", kills: 2 }]
      for (const entry of payload.killData) {
        const killEarnings = entry.kills * config.perKillReward;
        if (killEarnings > 0) {
          creditWinnings(entry.userId, killEarnings, `Full Map - ${entry.kills} kills @ ₹${config.perKillReward}/kill`);
          settlementSummary.push({ userId: entry.userId, kills: entry.kills, prize: killEarnings });
        }
      }
      break;
    }

    // -------------------------------------------------------------------------
    // 3, 4, 5. ONE TAP CUSTOMS (1v1: ₹50 Win, 2v2: ₹150 Win, 4v4: ₹200 Win)
    // -------------------------------------------------------------------------
    case "ONE_TAP_1V1":
    case "ONE_TAP_2V2":
    case "ONE_TAP_4V4": {
      // payload.winningTeamId = "TEAM_123"
      const winningEntry = match.participants.find(p => p.teamId === payload.winningTeamId);
      if (!winningEntry) throw new Error("Winning team ID not found in match participants.");

      const teamMembers = winningEntry.players;
      const splitReward = config.winReward / teamMembers.length;

      for (const memberId of teamMembers) {
        creditWinnings(memberId, splitReward, `${config.name} - Match Winner Reward`);
        settlementSummary.push({ userId: memberId, prize: splitReward });
      }
      break;
    }

    default:
      throw new Error("Unhandled mode type");
  }

  match.status = "COMPLETED";
  match.results = settlementSummary;
  return { success: true, matchId, payouts: settlementSummary };
}

// ==========================================
// 5. EXPORTS
// ==========================================
module.exports = {
  TOURNAMENT_MODES,
  UPI_PROVIDERS,
  createUser,
  processUpiDeposit,
  deductEntryFee,
  creditWinnings,
  createMatch,
  joinMatch,
  settleMatchResults,
  _db: db // Expose db reference for inspection/testing
};

// ==========================================
// DEMO RUN / VERIFICATION TEST
// Run with: `node tournamentHelper.js`
// ==========================================
if (require.main === module) {
  console.log("=== Free Fire Tournament Backend Test Run ===\n");

  // 1. Create Players
  const p1 = createUser({ userId: "user_01", username: "Raistar_FF", ffUid: "12345678" });
  const p2 = createUser({ userId: "user_02", username: "Badge99_FF", ffUid: "87654321" });

  // 2. Deposit Funds via PhonePe and GPay
  console.log("Processing Deposits...");
  processUpiDeposit({
    userId: "user_01",
    amount: 100,
    upiProvider: "PHONEPE",
    upiId: "raistar@ybl",
    utrNumber: "420192837465"
  });

  processUpiDeposit({
    userId: "user_02",
    amount: 50,
    upiProvider: "GPAY",
    upiId: "badge99@okhdfcbank",
    utrNumber: "889977665544"
  });

  console.log(`User 1 Wallet: ₹${p1.wallet.totalBalance}`);
  console.log(`User 2 Wallet: ₹${p2.wallet.totalBalance}\n`);

  // 3. Test Full Map Per-Kill Mode (Entry: ₹7, Per Kill: ₹6)
  console.log("--- Testing Full Map Per-Kill Mode ---");
  const killMatch = createMatch("FULL_MAP_PER_KILL");
  joinMatch(killMatch.matchId, { userId: "user_01" });
  joinMatch(killMatch.matchId, { userId: "user_02" });
  console.log(`Balance after ₹7 entry deduction -> User 1: ₹${p1.wallet.totalBalance}, User 2: ₹${p2.wallet.totalBalance}`);

  // Settle: User 1 gets 4 kills (4 * 6 = ₹24), User 2 gets 1 kill (1 * 6 = ₹6)
  settleMatchResults(killMatch.matchId, {
    killData: [
      { userId: "user_01", kills: 4 },
      { userId: "user_02", kills: 1 }
    ]
  });
  console.log(`Balance after Per-Kill rewards -> User 1: ₹${p1.wallet.totalBalance}, User 2: ₹${p2.wallet.totalBalance}\n`);

  // 4. Test 1v1 One Tap Custom (Entry: ₹25, Win: ₹50)
  console.log("--- Testing 1v1 One Tap Custom ---");
  const oneTapMatch = createMatch("ONE_TAP_1V1");
  joinMatch(oneTapMatch.matchId, { teamId: "TEAM_P1", players: ["user_01"] });
  joinMatch(oneTapMatch.matchId, { teamId: "TEAM_P2", players: ["user_02"] });

  // Settle: Team 1 (User 1) wins
  settleMatchResults(oneTapMatch.matchId, { winningTeamId: "TEAM_P1" });
  console.log(`Balance after 1v1 settlement -> Winner (User 1): ₹${p1.wallet.totalBalance}, Loser (User 2): ₹${p2.wallet.totalBalance}`);
}