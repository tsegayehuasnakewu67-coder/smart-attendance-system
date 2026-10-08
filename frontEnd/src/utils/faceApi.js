/**
 * face-api.js helpers
 *
 * Model weights must be in /public/models:
 *   tiny_face_detector_model
 *   face_landmark_68_model
 *   face_recognition_model
 *
 * Download from:
 *   https://github.com/justadudewhohacks/face-api.js/tree/master/weights
 */
import * as faceapi from 'face-api.js';

const MODEL_URL = '/models';
const DETECTOR_OPTIONS = { inputSize: 416, scoreThreshold: 0.5 };
let loaded = false;

export const loadModels = async () => {
  if (loaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  loaded = true;
};

/** Returns 128-element plain Array or null if no face detected */
export const getDescriptor = async (videoEl) => {
  if (!videoEl || videoEl.readyState < 2) return null;

  const detections = await faceapi
    .detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions(DETECTOR_OPTIONS))
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (detections.length !== 1) return null;
  return Array.from(detections[0].descriptor);
};

/** Draw face box + landmarks onto an overlay canvas */
export const drawDetections = async (videoEl, canvasEl) => {
  const dets = await faceapi
    .detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions(DETECTOR_OPTIONS))
    .withFaceLandmarks();
  const dims = faceapi.matchDimensions(canvasEl, videoEl, true);
  const resized = faceapi.resizeResults(dets, dims);
  const ctx = canvasEl.getContext('2d');
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  faceapi.draw.drawDetections(canvasEl, resized);
  faceapi.draw.drawFaceLandmarks(canvasEl, resized);
};

export { faceapi };
