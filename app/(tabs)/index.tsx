import { Text, View, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useState, useEffect } from "react";
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

export default function Index() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<any>(null);
  const [saveLocation, setSaveLocation] = useState<string>('');
  const [lockFileName, setLockFileName] = useState<string>('');

  useEffect(() => {
    loadSaveLocation();
    requestPermissions();
  }, []);

  // Reload save location when tab becomes focused
  useFocusEffect(() => {
    loadSaveLocation();
  });

  const loadSaveLocation = async () => {
    try {
      const savedLocation = await AsyncStorage.getItem('saveLocation');
      if (savedLocation) {
        setSaveLocation(savedLocation);
      } else {
        setSaveLocation(FileSystem.documentDirectory || '');
      }
    } catch (error) {
      console.error('Error loading save location:', error);
      setSaveLocation(FileSystem.documentDirectory || '');
    }
  };

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
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
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

  const createLockFile = async () => {
    try {
      const lockName = `recording.lock`;
      const targetLocation = saveLocation || FileSystem.documentDirectory || '';
      
      let lockFileUri: string;
      
      if (targetLocation && targetLocation.startsWith('content://')) {
        // Using Storage Access Framework
        lockFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          targetLocation,
          lockName,
          'text/plain'
        );
        await FileSystem.writeAsStringAsync(lockFileUri, 'RECORDING_IN_PROGRESS', {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } else {
        // Regular file system
        lockFileUri = `${targetLocation}${lockName}`;
        await FileSystem.writeAsStringAsync(lockFileUri, 'RECORDING_IN_PROGRESS', {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }
      
      setLockFileName(lockName);
      return lockFileUri;
    } catch (error) {
      console.error('Error creating lock file:', error);
      return null;
    }
  };

  const removeLockFile = async () => {
    try {
      if (!lockFileName) return;
      
      const targetLocation = saveLocation || FileSystem.documentDirectory || '';
      
      if (targetLocation && targetLocation.startsWith('content://')) {
        // For SAF, we need to find and delete the lock file
        // This is complex with SAF, so we'll just clear the state for now
      } else {
        // Regular file system
        const lockFileUri = `${targetLocation}${lockFileName}`;
        await FileSystem.deleteAsync(lockFileUri, { idempotent: true });
      }
      
      setLockFileName('');
    } catch (error) {
      console.error('Error removing lock file:', error);
    }
  };

  const startRecording = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      // Create lock file
      await createLockFile();

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
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      // Remove lock file if recording failed to start
      await removeLockFile();
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      if (uri) {
        try {
          // Create the formatted filename
          const formattedFileName = getFormattedFileName();
          const targetLocation = saveLocation || FileSystem.documentDirectory || '';
          
          
          let newUri: string;
          
          if (targetLocation && targetLocation.startsWith('content://')) {
            // Using Storage Access Framework - create file in selected directory
            newUri = await FileSystem.StorageAccessFramework.createFileAsync(
              targetLocation,
              formattedFileName,
              'audio/m4a'
            );
            
            
            // For SAF, we need to read the original file and write to the new location
            const originalFile = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            
            await FileSystem.writeAsStringAsync(newUri, originalFile, {
              encoding: FileSystem.EncodingType.Base64,
            });
            
          } else {
            // Regular file system
            const fallbackLocation = targetLocation || FileSystem.documentDirectory || '';
            newUri = `${fallbackLocation}${formattedFileName}`;
            
            
            // Copy the file to the new location with the formatted name
            await FileSystem.copyAsync({
              from: uri,
              to: newUri,
            });
            
          }
          
          Alert.alert('Recording Saved', `Recording saved as: ${formattedFileName}`);
        } catch (saveError) {
          console.error('Error saving file:', saveError);
          Alert.alert('Save Error', 'Failed to save recording. Check console for details.');
        }
      }
      
      // Remove lock file
      await removeLockFile();
      
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
