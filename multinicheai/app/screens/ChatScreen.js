// screens/ChatScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { api } from "../api/client";

export default function ChatScreen({ route, navigation }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [balance, setBalance] = useState(route.params?.creditBalance ?? 0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!input.trim()) return;
    setError("");

    // Fair-practice: show cost estimate and confirm affordability before sending
    try {
      const preview = await api.estimateCost(input);
      if (!preview.affordable) {
        setError(
          `That message costs about ${preview.estimated_credits} credits — you don't have enough. Top up to continue.`
        );
        return;
      }
    } catch (e) {
      setError(e.message);
      return;
    }

    const userMessage = { role: "user", content: input };
    const historyForApi = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      const result = await api.sendMessage(userMessage.content, historyForApi);
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
      setBalance(result.remaining_balance);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>multiNicheAI</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Credits")}>
          <Text style={styles.balance}>{balance.toFixed(1)} credits</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.aiBubble]}>
            <Text style={item.role === "user" ? styles.userText : styles.aiText}>
              {item.content}
            </Text>
          </View>
        )}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Ask multiNicheAI..."
          value={input}
          onChangeText={setInput}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={sending}>
          <Text style={styles.sendText}>{sending ? "..." : "Send"}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: { fontSize: 17, fontWeight: "600" },
  balance: { fontSize: 13, color: "#185fa5" },
  messageList: { padding: 16, gap: 8 },
  bubble: { borderRadius: 12, padding: 12, marginBottom: 8, maxWidth: "80%" },
  userBubble: { backgroundColor: "#1a1a18", alignSelf: "flex-end" },
  aiBubble: { backgroundColor: "#f0efe9", alignSelf: "flex-start" },
  userText: { color: "#fff", fontSize: 14 },
  aiText: { color: "#1a1a18", fontSize: 14 },
  inputRow: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: "#1a1a18",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sendText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  error: { color: "#c0392b", fontSize: 12, paddingHorizontal: 16, paddingBottom: 4 },
});
