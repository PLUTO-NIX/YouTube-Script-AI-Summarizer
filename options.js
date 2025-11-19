// options.js

// AI 모델 설정 상수
const AI_MODELS = {
    'openai-o4-mini': {
        id: 'openai-o4-mini',
        name: 'OpenAI o4-mini',
        provider: 'openai',
        model: 'o4-mini',
        description: '빠르고 경제적인 모델',
        apiKeyRequired: 'openai_api_key'
    },
    'gemini-2.5-pro': {
        id: 'gemini-2.5-pro',
        name: 'Google Gemini 2.5 Pro',
        provider: 'gemini',
        model: 'gemini-2.5-pro',
        description: '최신 고성능 모델',
        apiKeyRequired: 'gemini_api_key'
    },
    'gemini-3-pro-preview': {
        id: 'gemini-3-pro-preview',
        name: 'Google Gemini 3 Pro Preview',
        provider: 'gemini',
        model: 'gemini-3-pro-preview',
        description: '최신 프리뷰 버전',
        apiKeyRequired: 'gemini_api_key'
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const geminiApiKeyInput = document.getElementById('geminiApiKey');
    const youtubeApiKeyInput = document.getElementById('youtubeApiKey');
    const userPromptTextarea = document.getElementById('userPrompt');
    const commentsPromptTextarea = document.getElementById('commentsPrompt');
    const saveButton = document.getElementById('saveSettings');
    const clearButton = document.getElementById('clearSummaries');
    const statusDiv = document.getElementById('status');
    const defaultPromptRadio = document.getElementById('defaultPrompt');
    const customPromptRadio = document.getElementById('customPrompt');
    const customPromptGroup = document.getElementById('customPromptGroup');
    const youtubeApiHelp = document.getElementById('youtubeApiHelp');
    const aiModelRadios = document.querySelectorAll('input[name="aiModel"]');
    const modelWarning = document.getElementById('modelWarning');

    // 라디오 버튼 변경 처리
    function handlePromptTypeChange() {
        if (customPromptRadio.checked) {
            customPromptGroup.style.display = 'block';
        } else {
            customPromptGroup.style.display = 'none';
        }
    }

    defaultPromptRadio.addEventListener('change', handlePromptTypeChange);
    customPromptRadio.addEventListener('change', handlePromptTypeChange);

    // YouTube API 도움말 클릭 이벤트
    youtubeApiHelp.addEventListener('click', (e) => {
        e.preventDefault();
        showYouTubeAPIHelp();
    });

    // 모델 선택 변경 시 경고 표시
    function handleModelChange() {
        const selectedModel = document.querySelector('input[name="aiModel"]:checked')?.value;
        const modelConfig = AI_MODELS[selectedModel];

        if (modelConfig) {
            const requiredApiKey = modelConfig.apiKeyRequired;
            const apiKeyInput = document.getElementById(
                requiredApiKey === 'openai_api_key' ? 'apiKey' : 'geminiApiKey'
            );

            if (!apiKeyInput.value.trim()) {
                modelWarning.style.display = 'block';
                modelWarning.innerHTML = `<p>⚠️ ${modelConfig.name} 모델을 사용하려면 ${requiredApiKey === 'openai_api_key' ? 'OpenAI' : 'Gemini'
                    } API 키가 필요합니다.</p>`;
            } else {
                modelWarning.style.display = 'none';
            }
        }
    }

    // 라디오 버튼 이벤트 리스너
    aiModelRadios.forEach(radio => {
        radio.addEventListener('change', handleModelChange);
    });

    // API 키 입력 시에도 경고 업데이트
    apiKeyInput.addEventListener('input', handleModelChange);
    geminiApiKeyInput.addEventListener('input', handleModelChange);

    // 저장된 설정 불러오기
    chrome.storage.local.get(['openai_api_key', 'gemini_api_key', 'youtube_api_key', 'user_prompt', 'comments_prompt', 'selected_ai_model'], (result) => {
        if (chrome.runtime.lastError) {
            console.error('설정 로딩 오류:', chrome.runtime.lastError);
            return;
        }

        if (result.openai_api_key) {
            apiKeyInput.value = result.openai_api_key;
        }

        if (result.gemini_api_key) {
            geminiApiKeyInput.value = result.gemini_api_key;
        }

        if (result.youtube_api_key) {
            youtubeApiKeyInput.value = result.youtube_api_key;
        }

        if (result.user_prompt) {
            userPromptTextarea.value = result.user_prompt;
            customPromptRadio.checked = true;
            handlePromptTypeChange();
        }

        if (result.comments_prompt) {
            commentsPromptTextarea.value = result.comments_prompt;
        }

        if (result.selected_ai_model) {
            const modelRadio = document.getElementById(result.selected_ai_model);
            if (modelRadio) {
                modelRadio.checked = true;
                handleModelChange();
            }
        } else {
            // 기존 사용자는 기본값으로 OpenAI 사용
            handleModelChange();
        }
    });

    // 저장 버튼 클릭 이벤트
    saveButton.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        const geminiApiKey = geminiApiKeyInput.value.trim();
        const youtubeApiKey = youtubeApiKeyInput.value.trim();
        const userPrompt = customPromptRadio.checked ? userPromptTextarea.value.trim() : '';
        const commentsPrompt = commentsPromptTextarea.value.trim();
        const selectedModel = document.querySelector('input[name="aiModel"]:checked')?.value || 'openai-o4-mini';

        // 선택한 모델에 필요한 API 키 검증
        const modelConfig = AI_MODELS[selectedModel];
        if (modelConfig) {
            const requiredApiKey = modelConfig.apiKeyRequired;
            const keyValue = requiredApiKey === 'openai_api_key' ? apiKey : geminiApiKey;

            if (!keyValue) {
                showStatus(`${modelConfig.name} 모델을 사용하려면 해당 API 키가 필요합니다.`, 'error');
                return;
            }
        }

        chrome.storage.local.set({
            openai_api_key: apiKey,
            gemini_api_key: geminiApiKey,
            youtube_api_key: youtubeApiKey,
            user_prompt: userPrompt,
            comments_prompt: commentsPrompt,
            selected_ai_model: selectedModel
        }, () => {
            if (chrome.runtime.lastError) {
                console.error('설정 저장 오류:', chrome.runtime.lastError);
                showStatus('설정을 저장하는 중 오류가 발생했습니다.', 'error');
                return;
            }

            showStatus('설정이 성공적으로 저장되었습니다!', 'success');
        });
    });

    // 요약 삭제 버튼 클릭 이벤트
    clearButton.addEventListener('click', () => {
        if (confirm('저장된 모든 요약을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            chrome.storage.local.get(null, (items) => {
                const keysToRemove = Object.keys(items).filter(key =>
                    key.startsWith('summary_') || key.startsWith('comments_summary_')
                );

                if (keysToRemove.length > 0) {
                    chrome.storage.local.remove(keysToRemove, () => {
                        if (chrome.runtime.lastError) {
                            console.error('요약 삭제 오류:', chrome.runtime.lastError);
                            showStatus('요약을 삭제하는 중 오류가 발생했습니다.', 'error');
                            return;
                        }
                        showStatus(`${keysToRemove.length}개의 요약이 성공적으로 삭제되었습니다.`, 'success');
                    });
                } else {
                    showStatus('저장된 요약이 없습니다.', 'success');
                }
            });
        }
    });

    // 상태 메시지 표시
    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status status-${type}`;
        statusDiv.style.display = 'block';

        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }

    // YouTube API 도움말 표시
    function showYouTubeAPIHelp() {
        const helpContent = `
YouTube Data API 키 발급 방법:

1. Google Cloud Console (https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. "API 및 서비스" > "라이브러리" 이동
4. "YouTube Data API v3" 검색 후 활성화
5. "API 및 서비스" > "사용자 인증 정보" 이동
6. "+ 사용자 인증 정보 만들기" > "API 키" 선택
7. 생성된 API 키를 복사하여 여기에 입력

무료 할당량: 일일 10,000 요청
일반적 사용량에서는 비용이 거의 발생하지 않습니다.
        `;

        alert(helpContent);
    }
});
