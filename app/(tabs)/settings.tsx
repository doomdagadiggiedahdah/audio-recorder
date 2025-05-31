import { Text, View, StyleSheet, TouchableOpacity, Alert, ScrollView, Platform } from "react-native";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Settings() {
  const [saveLocation, setSaveLocation] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedLocation = await AsyncStorage.getItem('saveLocation');
      if (savedLocation) {
        setSaveLocation(savedLocation);
      } else {
        // Default to Documents directory
        setSaveLocation(FileSystem.documentDirectory || '');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const chooseSaveLocation = async () => {
    try {
      if (Platform.OS === 'android') {
        // Use Storage Access Framework for Android folder selection
        const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        
        if (permission.granted) {
          const directoryUri = permission.directoryUri;
          
          // Save the location
          await AsyncStorage.setItem('saveLocation', directoryUri);
          setSaveLocation(directoryUri);
          
          Alert.alert('Success', 'Folder selected! Recordings will be saved here.');
        } else {
          Alert.alert('Permission Denied', 'Folder access was not granted.');
        }
      } else {
        // iOS fallback - use default directory
        Alert.alert('Info', 'Folder selection is only available on Android. Using default location.');
      }
    } catch (error) {
      console.error('Error choosing location:', error);
      Alert.alert('Error', 'Failed to select folder. Using default directory.');
    }
  };

  const resetToDefault = async () => {
    try {
      const defaultLocation = FileSystem.documentDirectory || '';
      await AsyncStorage.setItem('saveLocation', defaultLocation);
      setSaveLocation(defaultLocation);
      Alert.alert('Success', 'Reset to default location!');
    } catch (error) {
      console.error('Error resetting location:', error);
    }
  };

  const testWritePermission = async () => {
    try {
      if (saveLocation.startsWith('content://')) {
        // Using Storage Access Framework URI
        const testFileName = 'test_write.txt';
        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          saveLocation,
          testFileName,
          'text/plain'
        );
        
        await FileSystem.writeAsStringAsync(fileUri, 'test', { encoding: FileSystem.EncodingType.UTF8 });
        await FileSystem.deleteAsync(fileUri);
        Alert.alert('Success', 'Write permission confirmed!');
      } else {
        // Regular file system
        const testFile = `${saveLocation}test_write.txt`;
        await FileSystem.writeAsStringAsync(testFile, 'test', { encoding: FileSystem.EncodingType.UTF8 });
        await FileSystem.deleteAsync(testFile);
        Alert.alert('Success', 'Write permission confirmed!');
      }
    } catch (error) {
      console.error('Write test failed:', error);
      Alert.alert('Error', 'Cannot write to this location. Please choose another folder.');
    }
  };

  const getLocationDisplayName = (path: string) => {
    if (!path) return 'None selected';
    
    // Extract meaningful folder name
    const parts = path.split('/');
    const meaningfulParts = parts.filter(part => 
      part && 
      !part.includes('com.') && 
      !part.includes('android') &&
      !part.includes('data') &&
      part !== 'files'
    );
    
    if (meaningfulParts.length > 0) {
      return meaningfulParts[meaningfulParts.length - 1] || 'App Documents';
    }
    
    return 'App Documents';
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Settings</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recording Location</Text>
        <Text style={styles.sectionDescription}>
          Choose where to save your recordings. Default is the app's private storage.
        </Text>
        
        <View style={styles.locationContainer}>
          <View style={styles.locationInfo}>
            <Ionicons name="folder" size={20} color="#007AFF" />
            <View style={styles.locationText}>
              <Text style={styles.locationName}>
                {getLocationDisplayName(saveLocation)}
              </Text>
              <Text style={styles.locationPath} numberOfLines={2}>
                {saveLocation || 'Default app storage'}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.button} onPress={chooseSaveLocation}>
          <Ionicons name="folder-open" size={20} color="#ffffff" />
          <Text style={styles.buttonText}>Choose Folder</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={resetToDefault}>
          <Ionicons name="refresh" size={20} color="#007AFF" />
          <Text style={styles.secondaryButtonText}>Reset to Default</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={testWritePermission}>
          <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
          <Text style={styles.secondaryButtonText}>Test Write Permission</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>File Format</Text>
        <Text style={styles.sectionDescription}>
          Recordings are saved as M4A files with timestamp naming.
        </Text>
        <View style={styles.infoRow}>
          <Ionicons name="document" size={20} color="#666666" />
          <Text style={styles.infoText}>Format: 2025-02-07 19-00-43 0.m4a</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.infoRow}>
          <Ionicons name="information-circle" size={20} color="#666666" />
          <Text style={styles.infoText}>Mic Recorder v1.0</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="musical-notes" size={20} color="#666666" />
          <Text style={styles.infoText}>High-quality audio recording</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  contentContainer: {
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 30,
  },
  loadingText: {
    color: "#ffffff",
    fontSize: 18,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: "#cccccc",
    marginBottom: 16,
    lineHeight: 20,
  },
  locationContainer: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationText: {
    marginLeft: 12,
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  locationPath: {
    fontSize: 12,
    color: "#999999",
    flexWrap: "wrap",
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#007AFF",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  infoText: {
    color: "#cccccc",
    fontSize: 14,
    marginLeft: 12,
  },
});