import 'package:flutter/material.dart';

void main() {
  runApp(FreeFireTournamentApp());
}

class FreeFireTournamentApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(), 
      home: TournamentHomeScreen(),
    );
  }
}

class TournamentHomeScreen extends StatelessWidget {
  final List<Map<String, dynamic>> matches = [
    {"mode": "Survival Mode", "type": "Normal", "fee": 6, "prize": "Pool Distribution", "perKill": 0},
    {"mode": "Full Map", "type": "Per-Kill", "fee": 7, "prize": "Pool Remaining", "perKill": 6},
    {"mode": "1v1 One Tap", "type": "Custom", "fee": 25, "prize": "₹50 Win", "perKill": 0},
    {"mode": "2v2 One Tap", "type": "Custom", "fee": 23, "prize": "₹150 Win", "perKill": 0},
    {"mode": "4v4 One Tap", "type": "Custom", "fee": 30, "prize": "₹200 Win", "perKill": 0},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("🏆 FF Tournament India"),
        actions: [
          IconButton(
            icon: Icon(Icons.account_balance_wallet, color: Colors.greenAccent),
            onPressed: () {
              Navigator.push(context, MaterialPageRoute(builder: (context) => WalletScreen()));
            },
          )
        ],
      ),
      body: ListView.builder(
        itemCount: matches.length,
        itemBuilder: (context, index) {
          final match = matches[index];
          return Card(
            margin: EdgeInsets.symmetric(horizontal: 15, vertical: 10),
            color: Colors.grey[850],
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: EdgeInsets.all(15),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(match['mode'], style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.orange)),
                  SizedBox(height: 5),
                  Text("Format: ${match['type']}", style: TextStyle(color: Colors.grey)),
                  SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.between,
                    children: [
                      Text("Entry Fee: ₹${match['fee']}", style: TextStyle(fontSize: 16, color: Colors.blueAccent)),
                      Text(match['perKill'] > 0 ? "Per Kill: ₹${match['perKill']}" : "Prize: ${match['prize']}", 
                           style: TextStyle(fontSize: 16, color: Colors.greenAccent)),
                    ],
                  ),
                  SizedBox(height: 15),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
                      onPressed: () {
                        showDialog(
                          context: context,
                          builder: (context) => AlertDialog(
                            title: Text("Join Match?"),
                            content: Text("Kya aap ₹${match['fee']} dekar join karna chahte hain?"),
                            actions: [
                              TextButton(onPressed: () => Navigator.pop(context), child: Text("No")),
                              TextButton(onPressed: () => Navigator.pop(context), child: Text("Yes")),
                            ],
                          ),
                        );
                      },
                      child: Text("Join Tournament", style: TextStyle(color: Colors.white)),
                    ),
                  )
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class WalletScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("Add Cash (India Only)")),
      body: Padding(
        padding: EdgeInsets.all(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text("Current Balance: ₹0", style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            SizedBox(height: 40),
            Text("Select Payment App to Add Cash:", style: TextStyle(fontSize: 16, color: Colors.grey)),
            SizedBox(height: 20),
            PaymentButton(appName: "Google Pay", color: Colors.blue, icon: Icons.g_mobiledata),
            SizedBox(height: 10),
            PaymentButton(appName: "PhonePe", color: Colors.purple, icon: Icons.account_balance),
            SizedBox(height: 10),
            PaymentButton(appName: "BHIM UPI", color: Colors.orange, icon: Icons.payment),
          ],
        ),
      ),
    );
  }
}

class PaymentButton extends StatelessWidget {
  final String appName;
  final Color color;
  final IconData icon;

  PaymentButton({required this.appName, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: ElevatedButton.icon(
        icon: Icon(icon, color: Colors.white),
        label: Text("Pay via $appName", style: TextStyle(color: Colors.white, fontSize: 16)),
        style: ElevatedButton.styleFrom(backgroundColor: color),
        onPressed: () {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text("$appName se payment request start ho rahi hai..."))
          );
        },
      ),
    );
  }
}

