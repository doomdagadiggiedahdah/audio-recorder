import { Text, View, StyleSheet, FlatList, TouchableOpacity, Alert } from "react-native";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';

interface Recording {
  name: string;
  uri: string;
  size: number;
  modificationTime: number;
}

export default function Recordings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [playingSound, setPlayingSound] = useState<Audio.Sound | null>(null);
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecordings();
    return () => {
      if (playingSound) {
        playingSound.unloadAsync();
      }
    };
  }, []);

  const loadRecordings = async () => {
    try {
      const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory!);
      const recordingFiles = files.filter(file => file.endsWith('.m4a'));
      
      const recordingsWithInfo = await Promise.all(
        recordingFiles.map(async (file) => {
          const uri = `${FileSystem.documentDirectory}${file}`;
          const info = await FileSystem.getInfoAsync(uri);
          return {
            name: file,
            uri,
            size: info.size || 0,
            modificationTime: info.modificationTime || 0,
          };
        })
      );

      // Sort by modification time (newest first)
      recordingsWithInfo.sort((a, b) => b.modificationTime - a.modificationTime);
      setRecordings(recordingsWithInfo);
    } catch (error) {
      console.error('Error loading recordings:', error);
      Alert.alert('Error', 'Failed to load recordings');
    } finally {
      setLoading(false);
    }
  };

  const playRecording = async (uri: string) => {
    try {
      // Stop current playback if any
      if (playingSound) {
        await playingSound.unloadAsync();
        setPlayingSound(null);
        setPlayingUri(null);
      }

      // If clicking the same recording that was playing, just stop
      if (playingUri === uri) {
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );

      setPlayingSound(sound);
      setPlayingUri(uri);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingSound(null);
          setPlayingUri(null);
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error('Error playing recording:', error);
      Alert.alert('Error', 'Failed to play recording');
    }
  };

  const deleteRecording = async (uri: string, name: string) => {
    Alert.alert(
      'Delete Recording',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystem.deleteAsync(uri);
              await loadRecordings(); // Refresh the list
              Alert.alert('Success', 'Recording deleted');
            } catch (error) {
              console.error('Error deleting recording:', error);
              Alert.alert('Error', 'Failed to delete recording');
            }
          },
        },
      ]
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const renderRecording = ({ item }: { item: Recording }) => (
    <View style={styles.recordingItem}>
      <View style={styles.recordingInfo}>
        <Text style={styles.recordingName}>{item.name}</Text>
        <Text style={styles.recordingDetails}>
          {formatFileSize(item.size)} • {formatDate(item.modificationTime)}
        </Text>
      </View>
      <View style={styles.recordingActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => playRecording(item.uri)}
        >
          <Ionicons
            name={playingUri === item.uri ? "stop" : "play"}
            size={24}
            color="#007AFF"
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => deleteRecording(item.uri, item.name)}
        >
          <Ionicons name="trash" size={24} color="#ff4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading recordings...</Text>
      </View>
    );
  }

  if (recordings.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="mic-off" size={64} color="#666666" />
        <Text style={styles.emptyText}>No recordings yet</Text>
        <Text style={styles.emptySubtext}>
          Go to the Record tab to create your first recording
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={recordings}
        renderItem={renderRecording}
        keyExtractor={(item) => item.uri}
        style={styles.list}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    padding: 20,
  },
  loadingText: {
    color: "#ffffff",
    fontSize: 18,
  },
  emptyText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 20,
    textAlign: "center",
  },
  emptySubtext: {
    color: "#cccccc",
    fontSize: 16,
    marginTop: 10,
    textAlign: "center",
  },
  list: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
  },
  recordingItem: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recordingInfo: {
    flex: 1,
    marginRight: 16,
  },
  recordingName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  recordingDetails: {
    color: "#cccccc",
    fontSize: 14,
  },
  recordingActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
});