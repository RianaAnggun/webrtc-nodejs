const socket = io();

const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

const peerConnections = {};

// ========================================
// LOGIKA BROADCASTER
// ========================================
export async function startBroadcast() {
    const localVideo = document.getElementById('localVideo');
    const tokenDisplay = document.getElementById('token');

    // Membuat token unik
    
const roomId = Math.random().toString(36).substring(2, 10);
tokenDisplay.innerText = roomId;

const copyButton = document.getElementById('copyTokenBtn');

copyButton?.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(roomId);
        copyButton.textContent = '✓ Token Tersalin';

        setTimeout(() => {
            copyButton.textContent = '▢ Salin Token';
        }, 1800);
    } catch (error) {
        alert('Token room kamu: ' + roomId);
    }
});


    // Bergabung ke room
    socket.emit('join-room', roomId);

    // Meminta akses kamera dan mikrofon
    const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    });

    localVideo.srcObject = localStream;
    
    // ========================================
    // LIVE AUTO SUBTITLE - BROADCASTER
    // ========================================

  
    // ========================================
    // LIVE AUTO SUBTITLE - BROADCASTER
    // ========================================

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    const startCaptionBtn =
        document.getElementById('startCaptionBtn');

    const speechStatus =
        document.getElementById('speechStatus');

    if (!SpeechRecognition) {
        if (speechStatus) {
            speechStatus.textContent =
                'Browser tidak mendukung Speech Recognition';
        }

        console.error('SpeechRecognition tidak tersedia.');
    } else {
        const recognition = new SpeechRecognition();

        recognition.lang = 'id-ID';
        recognition.continuous = true;
        recognition.interimResults = true;

        let recognitionActive = false;
        let manuallyStopped = false;

        recognition.onstart = () => {
            recognitionActive = true;

            if (speechStatus) {
                speechStatus.textContent = 'Mendengarkan suara...';
            }

            if (startCaptionBtn) {
                startCaptionBtn.textContent = '🎙️ Subtitle Aktif';
            }

            console.log('Speech recognition aktif.');
        };

        recognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const transcript = result[0].transcript.trim();

                if (!transcript) continue;

                console.log('Subtitle:', transcript);

                socket.emit('caption', {
                    roomId,
                    text: transcript,
                    isFinal: result.isFinal
                });
            }
        };

        recognition.onerror = (event) => {
            console.error(
                'Speech recognition error:',
                event.error
            );

            if (speechStatus) {
                speechStatus.textContent =
                    'Subtitle error: ' + event.error;
            }
        };

        recognition.onend = () => {
            recognitionActive = false;

            if (manuallyStopped) return;

            setTimeout(() => {
                if (!manuallyStopped && !recognitionActive) {
                    try {
                        recognition.start();
                    } catch (error) {
                        console.warn(
                            'Gagal memulai ulang subtitle:',
                            error.message
                        );
                    }
                }
            }, 1000);
        };

        startCaptionBtn?.addEventListener('click', () => {
            if (recognitionActive) return;

            manuallyStopped = false;

            try {
                recognition.start();
            } catch (error) {
                console.error(error);

                if (speechStatus) {
                    speechStatus.textContent =
                        'Gagal memulai subtitle. Coba klik lagi.';
                }
            }
        });

        window.stopLiveCaptions = () => {
            manuallyStopped = true;
            recognition.stop();
        };
    }

const cameraStatus = document.getElementById('cameraStatus');
const broadcastStatus = document.getElementById('broadcastStatus');

if (cameraStatus) {
    cameraStatus.textContent = 'Kamera berhasil diakses';
    cameraStatus.className = 'status success';
}

if (broadcastStatus) {
    broadcastStatus.textContent = 'Kamera aktif, siap menyiarkan video.';
    broadcastStatus.className = 'status success';
}


    // Ketika viewer bergabung
    socket.on('viewer-joined', async ({ viewerId }) => {
        console.log('Viewer bergabung:', viewerId);

        const pc = new RTCPeerConnection(config);
        peerConnections[viewerId] = pc;

        // Mengirim track kamera dan audio
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });

        // Mengirim ICE candidate
        pc.onicecandidate = event => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    roomId,
                    candidate: event.candidate
                });
            }
        };

        // Membuat offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('offer', {
            target: viewerId,
            sdp: offer
        });
    });

    // Menerima answer dari viewer
    socket.on('answer', async ({ sdp, viewerId }) => {
        const pc = peerConnections[viewerId];

        if (pc) {
            await pc.setRemoteDescription(
                new RTCSessionDescription(sdp)
            );
        }
    });

    // Menerima ICE candidate dari viewer
    socket.on('ice-candidate', async ({ candidate, senderId }) => {
        const pc = peerConnections[senderId];

        if (pc && candidate) {
            try {
                await pc.addIceCandidate(
                    new RTCIceCandidate(candidate)
                );
            } catch (error) {
                console.error('Gagal menambahkan ICE candidate:', error);
            }
        }
    });
}

// ========================================
// LOGIKA VIEWER
// ========================================
export async function startView(roomId) {
    let peerConnection;
    const remoteVideo = document.getElementById('remoteVideo');

    
    const subtitleText = document.getElementById('subtitleText');
    const subtitlePanel = document.getElementById('subtitlePanel');

    socket.off('caption');

    
socket.on('caption', ({ text, isFinal }) => {
    console.log('Caption diterima Viewer:', text, isFinal);

    if (!subtitleText || !text) {
        console.warn('Elemen subtitle tidak ditemukan atau teks kosong.');
        return;
    }

    subtitleText.textContent = text;
    subtitlePanel?.classList.add('is-listening');
});

    
const joinStatus = document.getElementById('joinStatus');
const connectionStatus = document.getElementById('connectionStatus');

if (joinStatus) {
    joinStatus.textContent = 'Token diterima. Mencari broadcaster...';
}

if (connectionStatus) {
    connectionStatus.textContent = 'Menunggu koneksi WebRTC...';
}


    // Mencegah listener ganda jika tombol Join ditekan berulang kali
    socket.off('offer');
    socket.off('ice-candidate');

    // Mendaftar sebagai viewer
    socket.emit('join-as-viewer', roomId);

    // Menerima offer dari broadcaster
    socket.on('offer', async ({ sdp, broadcasterId }) => {
        console.log('Menerima offer dari broadcaster');

        peerConnection = new RTCPeerConnection(config);

        // Menampilkan video yang diterima
        peerConnection.ontrack = event => {
            if (event.streams && event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
                
if (joinStatus) {
    joinStatus.textContent = 'Berhasil bergabung ke room!';
    joinStatus.className = 'status success';
}

if (connectionStatus) {
    connectionStatus.textContent = 'Terhubung — video sedang diterima.';
    connectionStatus.className = 'status success';
}

            }
        };

        // Mengirim ICE candidate ke server
        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    roomId,
                    candidate: event.candidate
                });
            }
        };

        // Membuat answer
        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(sdp)
        );

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.emit('answer', {
            target: broadcasterId,
            sdp: answer
        });
    });

    // Menerima ICE candidate dari broadcaster
    socket.on('ice-candidate', async ({ candidate, senderId }) => {
        if (peerConnection && candidate) {
            try {
                await peerConnection.addIceCandidate(
                    new RTCIceCandidate(candidate)
                );
            } catch (error) {
                console.error('Gagal menambahkan ICE candidate:', error);
            }
        }
    });
}
