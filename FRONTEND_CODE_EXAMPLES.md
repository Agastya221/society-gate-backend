# React Native Frontend - Code Examples

## API Service Layer

### 1. API Client Setup

```typescript
// services/api/client.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

const API_BASE_URL = 'https://api.yourapp.com/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      await AsyncStorage.multiRemove(['authToken', 'user']);
      // Navigate to login (use navigation ref)
      Alert.alert('Session Expired', 'Please login again');
    } else if (error.response?.status === 403) {
      Alert.alert('Access Denied', error.response.data?.message || 'You don\'t have permission');
    } else if (error.response?.status >= 500) {
      Alert.alert('Server Error', 'Something went wrong. Please try again later.');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

### 2. Auth Service

```typescript
// services/api/auth.service.ts
import apiClient from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LoginResponse {
  token: string;
  user: User;
  appType: string;
}

class AuthService {
  async sendOTP(phone: string) {
    return apiClient.post('/auth/otp/send', { phone });
  }

  async verifyOTP(phone: string, otp: string, name: string, email?: string) {
    const response = await apiClient.post<LoginResponse>('/auth/otp/verify', {
      phone,
      otp,
      name,
      email,
    });

    // Store token and user
    await AsyncStorage.setItem('authToken', response.token);
    await AsyncStorage.setItem('user', JSON.stringify(response.user));

    return response;
  }

  async login(phone: string, password: string, appType: 'resident' | 'guard') {
    const endpoint = appType === 'resident' ? '/auth/resident/login' : '/auth/guard/login';

    const response = await apiClient.post<LoginResponse>(endpoint, {
      phone,
      password,
    });

    await AsyncStorage.setItem('authToken', response.token);
    await AsyncStorage.setItem('user', JSON.stringify(response.user));

    return response;
  }

  async logout() {
    await AsyncStorage.multiRemove(['authToken', 'user']);
  }

  async getProfile() {
    return apiClient.get('/auth/profile');
  }

  async updateProfile(data: { name?: string; email?: string; photoUrl?: string }) {
    return apiClient.patch('/auth/profile', data);
  }

  async getCurrentUser(): Promise<User | null> {
    const userStr = await AsyncStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }
}

export default new AuthService();
```

### 3. Gate Service

```typescript
// services/api/gate.service.ts
import apiClient from './client';

class GateService {
  // Entries
  async getEntries(params?: { status?: string; page?: number; limit?: number }) {
    return apiClient.get('/gate/entries', { params });
  }

  async getPendingEntries() {
    return apiClient.get('/gate/entries/pending');
  }

  async approveEntry(entryId: string) {
    return apiClient.patch(`/gate/entries/${entryId}/approve`);
  }

  async rejectEntry(entryId: string, reason: string) {
    return apiClient.patch(`/gate/entries/${entryId}/reject`, {
      rejectionReason: reason,
    });
  }

  async createEntry(data: {
    type: string;
    visitorName: string;
    visitorPhone?: string;
    purpose?: string;
    flatId: string;
    societyId: string;
  }) {
    return apiClient.post('/gate/entries', data);
  }

  async checkoutEntry(entryId: string, remarks?: string) {
    return apiClient.patch(`/gate/entries/${entryId}/checkout`, { remarks });
  }

  // Entry Requests (with photo)
  async createEntryRequest(data: {
    type: string;
    visitorName?: string;
    photoKey: string;
    flatId: string;
    societyId: string;
  }) {
    return apiClient.post('/gate/requests', data);
  }

  async getPendingRequests() {
    return apiClient.get('/gate/requests/pending');
  }

  async approveRequest(requestId: string) {
    return apiClient.patch(`/gate/requests/${requestId}/approve`);
  }

  async rejectRequest(requestId: string, reason: string) {
    return apiClient.patch(`/gate/requests/${requestId}/reject`, {
      rejectionReason: reason,
    });
  }

  // Pre-approvals
  async createPreApproval(data: {
    visitorName: string;
    visitorPhone?: string;
    validFrom: Date;
    validUntil: Date;
    purpose?: string;
  }) {
    return apiClient.post('/gate/preapprovals', data);
  }

  async getPreApprovals(status?: string) {
    return apiClient.get('/gate/preapprovals', {
      params: { status },
    });
  }

  async cancelPreApproval(id: string) {
    return apiClient.patch(`/gate/preapprovals/${id}/cancel`);
  }

  // Gate Passes
  async requestGatePass(data: {
    passType: string;
    purpose: string;
    validFrom: Date;
    validUntil: Date;
    vehicleNumber?: string;
  }) {
    return apiClient.post('/gate/passes', data);
  }

  async getGatePasses() {
    return apiClient.get('/gate/passes');
  }
}

export default new GateService();
```

### 4. Family Service

```typescript
// services/api/family.service.ts
import apiClient from './client';

class FamilyService {
  async getFamilyMembers() {
    return apiClient.get('/resident/family');
  }

  async inviteFamilyMember(data: {
    phone: string;
    name: string;
    email?: string;
    familyRole: 'SPOUSE' | 'CHILD' | 'PARENT' | 'SIBLING' | 'OTHER';
  }) {
    return apiClient.post('/resident/family/invite', data);
  }

  async removeFamilyMember(memberId: string) {
    return apiClient.delete(`/resident/family/${memberId}`);
  }

  async updateFamilyRole(memberId: string, familyRole: string) {
    return apiClient.patch(`/resident/family/${memberId}/role`, { familyRole });
  }
}

export default new FamilyService();
```

### 5. Upload Service

```typescript
// services/api/upload.service.ts
import apiClient from './client';
import axios from 'axios';

class UploadService {
  async getPresignedUrl(fileType: string, folder: string) {
    return apiClient.post<{
      uploadUrl: string;
      s3Key: string;
    }>('/upload/presigned-url', {
      fileType,
      folder,
    });
  }

  async uploadToS3(uploadUrl: string, file: Blob | File, fileType: string) {
    return axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': fileType,
      },
    });
  }

  async uploadPhoto(
    photo: { uri: string; type: string },
    folder: string
  ): Promise<string> {
    // 1. Get presigned URL
    const { uploadUrl, s3Key } = await this.getPresignedUrl(photo.type, folder);

    // 2. Create form data
    const formData = new FormData();
    formData.append('file', {
      uri: photo.uri,
      type: photo.type,
      name: `photo-${Date.now()}.jpg`,
    } as any);

    // 3. Upload to S3
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': photo.type,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    // 4. Return public URL
    return `https://s3.amazonaws.com/your-bucket/${s3Key}`;
  }
}

export default new UploadService();
```

### 6. Complaint Service

```typescript
// services/api/complaint.service.ts
import apiClient from './client';

class ComplaintService {
  async createComplaint(data: {
    category: string;
    priority: string;
    title: string;
    description: string;
    images: string[];
    location?: string;
  }) {
    return apiClient.post('/community/complaints', data);
  }

  async getMyComplaints(params?: { status?: string; page?: number }) {
    return apiClient.get('/community/complaints', { params });
  }

  async getComplaintDetails(complaintId: string) {
    return apiClient.get(`/community/complaints/${complaintId}`);
  }

  async deleteComplaint(complaintId: string) {
    return apiClient.delete(`/community/complaints/${complaintId}`);
  }
}

export default new ComplaintService();
```

---

## Socket.IO Integration

### Socket Service

```typescript
// services/socket/socket.service.ts
import io, { Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  async connect() {
    const token = await AsyncStorage.getItem('authToken');

    if (!token) {
      console.log('No auth token, skipping socket connection');
      return;
    }

    this.socket = io('https://api.yourapp.com', {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.log('Socket connection error:', error.message);
    });

    // Setup default listeners
    this.setupDefaultListeners();
  }

  private setupDefaultListeners() {
    if (!this.socket) return;

    // Notification event
    this.socket.on('notification', (data) => {
      console.log('📬 Notification received:', data);

      // Show local notification
      this.showLocalNotification(data.title, data.message);

      // Trigger registered listeners
      this.emit('notification', data);

      // Handle specific notification types
      switch (data.type) {
        case 'STAFF_CHECKIN':
          this.emit('staffCheckedIn', data.data);
          break;
        case 'STAFF_CHECKOUT':
          this.emit('staffCheckedOut', data.data);
          break;
        case 'ENTRY_REQUEST':
          this.emit('entryRequestReceived', data.data);
          break;
        case 'EMERGENCY_ALERT':
          this.emit('emergencyAlert', data.data);
          break;
      }
    });

    // Entry status update
    this.socket.on('entry:status-updated', (entry) => {
      console.log('Entry status updated:', entry);
      this.emit('entry:status-updated', entry);
    });

    // Complaint update
    this.socket.on('complaint:updated', (complaint) => {
      console.log('Complaint updated:', complaint);
      this.emit('complaint:updated', complaint);
    });
  }

  private showLocalNotification(title: string, body: string) {
    // Use expo-notifications or react-native-push-notification
    Alert.alert(title, body);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Event listener management
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((callback) => callback(data));
    }
  }
}

export default new SocketService();
```

### Using Socket in Component

```typescript
// screens/HomeScreen.tsx
import React, { useEffect, useState } from 'react';
import socketService from '../services/socket/socket.service';

export default function HomeScreen() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Connect socket on mount
    socketService.connect();

    // Listen for notifications
    const handleNotification = (data: any) => {
      console.log('New notification:', data);
      setUnreadCount((prev) => prev + 1);

      // Optionally refresh data
      if (data.type === 'ENTRY_REQUEST') {
        fetchPendingEntries();
      }
    };

    socketService.on('notification', handleNotification);

    // Cleanup
    return () => {
      socketService.off('notification', handleNotification);
    };
  }, []);

  return (
    <View>
      <Text>Home Screen</Text>
      <Badge count={unreadCount} />
    </View>
  );
}
```

---

## React Context for Auth

### Auth Context

```typescript
// context/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import authService from '../services/api/auth.service';
import socketService from '../services/socket/socket.service';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, password: string, appType: 'resident' | 'guard') => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);

      if (currentUser) {
        // Connect socket if user is authenticated
        await socketService.connect();
      }
    } catch (error) {
      console.log('Failed to load user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (phone: string, password: string, appType: 'resident' | 'guard') => {
    const response = await authService.login(phone, password, appType);
    setUser(response.user);
    await socketService.connect();
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    socketService.disconnect();
  };

  const refreshUser = async () => {
    try {
      const response = await authService.getProfile();
      setUser(response.data);
    } catch (error) {
      console.log('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### Using Auth Context

```typescript
// screens/LoginScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      await login(phone, password, 'resident');
      // Navigation handled by AuthNavigator
    } catch (error: any) {
      Alert.alert('Login Failed', error.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <TextInput
        placeholder="Phone Number"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Login" onPress={handleLogin} disabled={loading} />
    </View>
  );
}
```

---

## Component Examples

### 1. Entry Request Card

```typescript
// components/EntryRequestCard.tsx
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';

interface Props {
  request: EntryRequest;
  onApprove: () => void;
  onReject: () => void;
}

export default function EntryRequestCard({ request, onApprove, onReject }: Props) {
  return (
    <View style={styles.card}>
      {request.photoKey && (
        <Image
          source={{ uri: `https://s3.amazonaws.com/bucket/${request.photoKey}` }}
          style={styles.photo}
          resizeMode="cover"
        />
      )}

      <View style={styles.content}>
        <Text style={styles.name}>{request.visitorName || 'Visitor'}</Text>
        <Text style={styles.type}>{request.type}</Text>

        {request.providerTag && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{request.providerTag}</Text>
          </View>
        )}

        <Text style={styles.time}>
          {formatRelativeTime(request.createdAt)}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.approveBtn} onPress={onApprove}>
          <Text style={styles.approveBtnText}>Approve</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.rejectBtn} onPress={onReject}>
          <Text style={styles.rejectBtnText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  content: {
    marginBottom: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  type: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  badgeText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
  },
  time: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectBtnText: {
    color: '#EF4444',
    fontWeight: '600',
  },
});
```

### 2. QR Scanner Screen

```typescript
// screens/QRScannerScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Camera, BarCodeScanningResult } from 'expo-camera';
import staffService from '../services/api/staff.service';

export default function QRScannerScreen({ navigation }) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  React.useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = async ({ data }: BarCodeScanningResult) => {
    if (scanned) return;

    setScanned(true);

    try {
      // data = qrToken from DomesticStaff
      const result = await staffService.scanQRCode(data);

      Alert.alert(
        'Success',
        `Staff ${result.action === 'CHECK_IN' ? 'checked in' : 'checked out'} successfully`,
        [
          {
            text: 'OK',
            onPress: () => {
              setScanned(false);
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Invalid QR code', [
        {
          text: 'Try Again',
          onPress: () => setScanned(false),
        },
      ]);
    }
  };

  if (hasPermission === null) {
    return <Text>Requesting camera permission...</Text>;
  }

  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <View style={styles.container}>
      <Camera
        style={styles.camera}
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        barCodeScannerSettings={{
          barCodeTypes: ['qr'],
        }}
      />

      <View style={styles.overlay}>
        <View style={styles.scanArea} />
        <Text style={styles.instruction}>
          Point camera at staff QR code
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 12,
  },
  instruction: {
    color: '#fff',
    fontSize: 16,
    marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
});
```

### 3. Complaint Creation Screen

```typescript
// screens/CreateComplaintScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import complaintService from '../services/api/complaint.service';
import uploadService from '../services/api/upload.service';

export default function CreateComplaintScreen({ navigation }) {
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    if (images.length >= 5) {
      Alert.alert('Limit Reached', 'Maximum 5 images allowed');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;

      // Upload to S3
      try {
        setLoading(true);
        const photoUrl = await uploadService.uploadPhoto(
          { uri, type: 'image/jpeg' },
          'complaints'
        );
        setImages([...images, photoUrl]);
      } catch (error) {
        Alert.alert('Upload Failed', 'Could not upload image');
      } finally {
        setLoading(false);
      }
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!category || !title || !description) {
      Alert.alert('Validation Error', 'Please fill all required fields');
      return;
    }

    try {
      setLoading(true);

      await complaintService.createComplaint({
        category,
        priority: 'MEDIUM',
        title,
        description,
        images,
      });

      Alert.alert('Success', 'Complaint filed successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to create complaint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Category *</Text>
      {/* Category picker */}

      <Text style={styles.label}>Title *</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Brief title"
      />

      <Text style={styles.label}>Description *</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the issue"
        multiline
        numberOfLines={4}
      />

      <Text style={styles.label}>Photos ({images.length}/5)</Text>
      <View style={styles.photosContainer}>
        {images.map((uri, index) => (
          <View key={index} style={styles.photoWrapper}>
            <Image source={{ uri }} style={styles.photo} />
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => removeImage(index)}
            >
              <Text style={styles.removeBtnText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}

        {images.length < 5 && (
          <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage}>
            <Text style={styles.addPhotoBtnText}>+</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitBtnText}>Submit Complaint</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F9FAFB',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoWrapper: {
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  addPhotoBtn: {
    width: 100,
    height: 100,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoBtnText: {
    fontSize: 32,
    color: '#9CA3AF',
  },
  submitBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

---

## Navigation Setup

```typescript
// navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';

// Auth Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import OTPScreen from '../screens/OTPScreen';

// Resident Screens
import HomeScreen from '../screens/resident/HomeScreen';
import GateScreen from '../screens/resident/GateScreen';
import StaffScreen from '../screens/resident/StaffScreen';
import CommunityScreen from '../screens/resident/CommunityScreen';
import ProfileScreen from '../screens/resident/ProfileScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function ResidentTabNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Gate" component={GateScreen} />
      <Tab.Screen name="Staff" component={StaffScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="OTP" component={OTPScreen} />
          </>
        ) : (
          <>
            {user?.role === 'RESIDENT' ? (
              <Stack.Screen name="ResidentTabs" component={ResidentTabNavigator} />
            ) : user?.role === 'GUARD' ? (
              <Stack.Screen name="GuardTabs" component={GuardTabNavigator} />
            ) : null}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

---

## Summary

These code examples provide a solid foundation for building the React Native app with:

✅ Complete API service layer with error handling
✅ Socket.IO real-time integration
✅ Auth context for state management
✅ Reusable UI components
✅ Camera/QR scanner integration
✅ Image upload with S3
✅ Navigation structure

Copy these examples and adapt them to your specific needs!
