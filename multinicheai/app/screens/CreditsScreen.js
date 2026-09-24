// screens/CreditsScreen.js
// Fair-practice: every pack shows its per-credit price so customers can
// compare honestly, and there's no pre-highlighted "recommended" pack
// designed to nudge people toward overspending.
import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking, ActivityIndicator } from "react-native";
import { api } from "../api/client";

const PACKS = [
  { id: "starter", label: "Starter", credits: 100, price: "$5", perCredit: "$0.050 / credit" },
  { id: "standard", label: "Standard", credits: 500, price: "$20", perCredit: "$0.040 / credit" },
  { id: "pro", label: "Pro", credits: 1500, price: "$50", perCredit: "$0.033 / credit" },
  { id: "power", label: "Power", credits: 5000, price: "$150", perCredit: "$0.030 / credit" },
];

export default function CreditsScreen() {
  const [loadingPack, setLoadingPack] = useState(null);
  const [error, setError] = useState("");

  const handleBuy = async (packId) => {
    setError("");
    setLoadingPack(packId);
    try {
      const { checkout_url } = await api.startCheckout(packId);
      await Linking.openURL(checkout_url);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingPack(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Buy credits</Text>
      <Text style={styles.subtitle}>One-time purchase. Credits never expire.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {PACKS.map((pack) => (
        <View key={pack.id} style={styles.card}>
          <View>
            <Text style={styles.packLabel}>{pack.label}</Text>
            <Text style={styles.packCredits}>{pack.credits} credits</Text>
            <Text style={styles.packPerCredit}>{pack.perCredit}</Text>
          </View>
          <TouchableOpacity
            style={styles.buyButton}
            onPress={() => handleBuy(pack.id)}
            disabled={loadingPack === pack.id}
          >
            {loadingPack === pack.id ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buyText}>{pack.price}</Text>
            )}
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#666", marginBottom: 20 },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  packLabel: { fontSize: 15, fontWeight: "500" },
  packCredits: { fontSize: 13, color: "#444", marginTop: 2 },
  packPerCredit: { fontSize: 11, color: "#999", marginTop: 2 },
  buyButton: {
    backgroundColor: "#1a1a18",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minWidth: 64,
    alignItems: "center",
  },
  buyText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  error: { color: "#c0392b", fontSize: 12, marginBottom: 12 },
});
