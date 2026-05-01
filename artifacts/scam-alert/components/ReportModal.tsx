import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  collection,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { generateId } from "@/lib/utils";

const REASONS = [
  "False information / Misinformation",
  "Spam or scam post",
  "Hate speech or harassment",
  "Violent or threatening content",
  "Sexual content",
  "Illegal activity",
  "Other",
];

interface Props {
  visible: boolean;
  postId: string;
  onClose: () => void;
}

export function ReportModal({ visible, postId, onClose }: Props) {
  const colors = useColors();
  const { user } = useAuth();
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason || !user) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "reports"), {
        id: generateId(),
        reporterId: user.uid,
        targetId: postId,
        targetType: "post",
        reason: selectedReason,
        details,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "posts", postId), {
        reports: arrayUnion(user.uid),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setSelectedReason("");
        setDetails("");
        onClose();
      }, 1500);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <Text style={[styles.title, { color: colors.text }]}>Report Post</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Help us keep Scam Alert safe and accurate.
        </Text>

        {submitted ? (
          <View style={styles.successContainer}>
            <Feather name="check-circle" size={48} color={colors.success} />
            <Text style={[styles.successText, { color: colors.text }]}>
              Report submitted. Thank you!
            </Text>
          </View>
        ) : (
          <>
            {REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[
                  styles.reasonRow,
                  {
                    borderColor:
                      selectedReason === reason ? colors.primary : colors.border,
                    backgroundColor:
                      selectedReason === reason
                        ? colors.primary + "15"
                        : colors.card,
                  },
                ]}
                onPress={() => setSelectedReason(reason)}
              >
                <View
                  style={[
                    styles.radio,
                    {
                      borderColor:
                        selectedReason === reason ? colors.primary : colors.border,
                      backgroundColor:
                        selectedReason === reason ? colors.primary : "transparent",
                    },
                  ]}
                />
                <Text style={[styles.reasonText, { color: colors.text }]}>
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}

            <TextInput
              style={[
                styles.input,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.card },
              ]}
              placeholder="Additional details (optional)"
              placeholderTextColor={colors.textMuted}
              value={details}
              onChangeText={setDetails}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[
                styles.submitBtn,
                {
                  backgroundColor: selectedReason ? colors.primary : colors.muted,
                },
              ]}
              onPress={handleSubmit}
              disabled={!selectedReason || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: 20,
    paddingBottom: 34,
    maxHeight: "85%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginBottom: 16,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  reasonText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginTop: 8,
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: "top",
  },
  submitBtn: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  submitText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  successContainer: {
    alignItems: "center",
    padding: 40,
    gap: 16,
  },
  successText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    textAlign: "center",
  },
});
