import { Text, View, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useState, useEffect } from "react";
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export default function Index() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<any>(null);

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant microphone permissions');
        return false;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      return true;
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  const getFormattedFileName = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}-${minutes}-${seconds} 0.m4a`;
  };

  const startRecording = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      const fileName = getFormattedFileName();
      const { recording: newRecording } = await Audio.Recording.createAsync(
        {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
          },
          ios: {
            extension: '.m4a',
            outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {
            mimeType: 'audio/webm;codecs=opus',
            bitsPerSecond: 128000,
          },
        }
      );
      
      setRecording(newRecording);
      setIsRecording(true);
      
      newRecording.setOnRecordingStatusUpdate((status) => {
        setRecordingStatus(status);
        if (status.isRecording) {
          const minutes = Math.floor((status.durationMillis || 0) / 60000);
          const seconds = Math.floor(((status.durationMillis || 0) % 60000) / 1000);
          setRecordTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      });
      
      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      if (uri) {
        // Create the formatted filename
        const formattedFileName = getFormattedFileName();
        const newUri = `${FileSystem.documentDirectory}${formattedFileName}`;
        
        // Copy the file to the new location with the formatted name
        await FileSystem.copyAsync({
          from: uri,
          to: newUri,
        });
        
        console.log('Recording saved with formatted name:', newUri);
        Alert.alert('Recording Saved', `Recording saved as: ${formattedFileName}`);
      }
      
      setRecording(null);
      setIsRecording(false);
      setRecordTime('00:00');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mic Recorder</Text>
      
      <View style={styles.recordingIndicator}>
        <View style={[styles.indicator, isRecording && styles.recording]} />
        <Text style={styles.statusText}>
          {isRecording ? "Recording..." : "Ready to record"}
        </Text>
      </View>

      <Text style={styles.timer}>
        {recordTime}
      </Text>

      <TouchableOpacity
        style={[styles.recordButton, isRecording && styles.recordingButton]}
        onPress={isRecording ? stopRecording : startRecording}
      >
        <Text style={styles.buttonText}>
          {isRecording ? "Stop" : "Record"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 40,
    color: "#ffffff",
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#666666",
    marginRight: 10,
  },
  recording: {
    backgroundColor: "#ff4444",
  },
  statusText: {
    fontSize: 16,
    color: "#cccccc",
  },
  timer: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 40,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  recordingButton: {
    backgroundColor: "#ff4444",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});
