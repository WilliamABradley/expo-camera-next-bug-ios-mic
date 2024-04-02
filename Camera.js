import { useEffect, useRef, useState } from "react";
import {
  Button,
  Platform,
  Linking,
  StyleSheet,
  View,
  Text,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera/next";
import { isDevice } from "expo-device";

import moment from "moment";
import _ from "lodash";

export const CameraScanner = ({ onData }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);

  const isCameraReady = useRef(false);
  const canRequestPermissions =
    Platform.OS === "android" || permission?.canAskAgain;

  // Once the permissions are granted, start a timer to check whether the camera started successfully
  // If it isn't ready in 15 seconds, show an error.
  useEffect(() => {
    if (!isCameraReady.current && permission?.granted) {
      setTimeout(() => {
        if (!isCameraReady.current) {
          setCameraFailed(true);
        }
      }, moment.duration(15, "seconds").as("milliseconds"));
    }
  }, [permission?.granted]);

  /** Request camera permissions */
  const requestCameraPermissions = async () => {
    if (canRequestPermissions) {
      // If possible, ask using the integrated prompt
      const permissions = await requestPermission();
      console.debug("Camera permission result", permissions);

      // Dealing with the Android 10+ issue described above:
      // If we get `granted: false`, we can't tell for sure whether a) the
      // user had previously denied access and therefore wasn't even shown a
      // prompt just now, or b) the user was shown a prompt but actively
      // denied it.
      if (!permissions.granted && IsAndroid) {
        await Linking.openSettings();
      }
    } else {
      // Open the settings
      await Linking.openSettings();
    }
  };

  // Debounce the barcode scanning so we don't get multiple scans.
  // This is a rather annoying problem to solve in a nicer way, most ways I've
  // seen have drawbacks such as:
  // - Can't return to the screen - it's left in a loading state
  // - Camera will scan while navigating to the next screen
  // It's probably possible to use some more advanced navigation hooks to
  // avoid these, but a simple debounce gets us most of the way.
  const debouncedScan = _.debounce(
    ({ data }) => onData(data),
    moment.duration(1, "second").as("milliseconds"),
    {
      leading: true,
      trailing: false,
    }
  );

  if (!!permission && !permission.granted) {
    return (
      <View>
        <Text>Requires camera permission</Text>
        <Button title="Request permission" onPress={requestCameraPermissions} />
      </View>
    );
  }

  if (cameraFailed || !isDevice) {
    return <Text>Camera failed to load</Text>;
  }

  return (
    <View style={styles.container}>
      {permission?.granted ? (
        <CameraView
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
          onBarcodeScanned={debouncedScan}
          onCameraReady={() => {
            console.debug("Camera ready");
            setCameraReady(true);
            isCameraReady.current = true;
          }}
          style={styles.camera}
        />
      ) : undefined}
      {!permission || !cameraReady ? (
        <View style={styles.loader}>
          <Text>Loading...</Text>
        </View>
      ) : undefined}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: "hidden",
    width: "100%",
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: "blue",
  },
  camera: {
    // For some reason if this is 100% there is a ~0.5 pixel gap between the
    // edge of the camera and the container...
    width: "101%",
    aspectRatio: 1,
    zIndex: 1,
    marginLeft: 0,
  },
  loader: {
    zIndex: 2,
    position: "absolute",
    height: "100%",
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "grey",
  },
});
