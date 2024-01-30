import React, { useRef, useState, useEffect } from 'react';
const MAX_RECORDING_TIME = 300; // Maximum recording time in seconds (e.g., 300 seconds for 5 minutes)

export default function RecorderPage() {
  const [isRecording, setRecording] = useState(false);
  const [isPaused, setPaused] = useState(false);
  const [videoURL, setVideoURL] = useState('');
  const [isScreenSharing, setScreenSharing] = useState(false);
  const [error, setError] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    // Request permissions and get stream on component mount
    const getMedia = async () => {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        videoRef.current.srcObject = streamRef.current;
      } catch (err) {
        if (err.name === 'NotAllowedError') {
          setError('Access to the camera and microphone was denied. Please provide the necessary permissions.');
        } else {
          setError('Could not access the camera or microphone. Please ensure you have given the necessary permissions.');
        }
      }
    };
    getMedia();
    return () => {
      // Cleanup on component unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);


  const handleStartRecording = () => {
    if (streamRef.current) {
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
      let chunks = [];
      mediaRecorderRef.current.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const completeBlob = new Blob(chunks, { type: 'video/webm' });
        setVideoURL(URL.createObjectURL(completeBlob));
      };
      mediaRecorderRef.current.start(1000);
      setRecording(true);
      setPaused(false);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        if (recordingTime >= MAX_RECORDING_TIME) {
          setError('Maximum recording time reached.');
          handleStopRecording();
          return;
        }
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      clearInterval(timerRef.current);
      setRecording(false);
      setPaused(false);
    }
  };

  const handlePauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setPaused(true);
      clearInterval(timerRef.current);
    }
  };

  const handleResumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  };

  const handleDownloadVideo = () => {
    fetch(videoURL)
      .then((res) => res.blob())
      .then((blob) => {
        const formData = new FormData();
        formData.append('video', blob, 'recording.webm');
        return fetch('/api/watermark', {
          method: 'POST',
          body: formData,
        });
      })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Server error: ' + response.statusText);
        }
        return response.blob();
      })
      .then((watermarkedBlob) => {
        const watermarkedURL = URL.createObjectURL(watermarkedBlob);
        const a = document.createElement('a');
        a.href = watermarkedURL;
        a.download = 'watermarked-recording.mp4';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(watermarkedURL);
      })
      .catch((error) => {
         // If the watermarked video download fails, download the original video
         const a = document.createElement('a');
         a.href = videoURL;
         a.download = 'recording.webm';
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         URL.revokeObjectURL(videoURL);
         setError('Failed to download the video with watermark. Downloading the original video instead.');
      });
  };

  const formatTime = (seconds) => {
    return new Date(seconds * 1000).toISOString().substr(11, 8);
  };
  // Function to toggle screen sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen sharing
      const videoTracks = streamRef.current.getVideoTracks();
      videoTracks.forEach((track) => track.stop());
      setScreenSharing(false);
      // Reset the video stream to the webcam
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      videoRef.current.srcObject = streamRef.current;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        handleStartRecording();
      }
    } else {
      // Start screen sharing
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        // Replace the current video track with the screen sharing track
        const videoTracks = streamRef.current.getVideoTracks();
        videoTracks.forEach((track) => streamRef.current.removeTrack(track));
        streamRef.current.addTrack(screenTrack);
        setScreenSharing(true);
        // If recording is in progress, replace the track in the recording
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
          handleStartRecording();
        }
      } catch (err) {
        setError('Could not start screen sharing.');
      }
    }
  };

  return (
    <div className="container mx-auto p-4">
      {error && <p className="text-red-500">{error}</p>}
      <div className="relative bg-black w-full h-64">
      <video ref={videoRef} autoPlay muted className="w-full h-full" />

      </div>
      {videoURL && (
        <div className="flex justify-center items-center">
          <video src={videoURL} controls className="w-full h-64" />
        </div>
      )}
      <div className="controls mt-4">
        <div className="flex justify-center space-x-2">
          {!isRecording && <button onClick={handleStartRecording} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 transition duration-300 ease-in-out">Start Recording</button>}
          {isRecording && !isPaused && <button onClick={handlePauseRecording} className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition duration-300 ease-in-out">Pause Recording</button>}
          {isRecording && isPaused && <button onClick={handleResumeRecording} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition duration-300 ease-in-out">Resume Recording</button>}
          {isRecording && <button onClick={handleStopRecording} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-700 transition duration-300 ease-in-out">Stop Recording</button>}
          {videoURL && <button onClick={handleDownloadVideo} id='download' className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-700 transition duration-300 ease-in-out">Download(with watermark)</button>}
          {!isRecording && <button onClick={toggleScreenShare} className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-700 transition duration-300 ease-in-out">{isScreenSharing ? 'Stop Sharing' : 'Share Screen'}</button>}
        </div>
      </div>
      <div className="status">
        <p className="text-lg">{isRecording ? (isPaused ? 'Paused' : 'Recording') : 'Not Recording'}</p>
        {recordingTime >= MAX_RECORDING_TIME && <p className="text-red-500">Maximum recording time reached. Please download or start a new recording.</p>}  
        <p className="text-sm">Recording Time: {formatTime(recordingTime)}</p>
      </div>
    </div>
  );


}
