// popup.js

document.addEventListener('DOMContentLoaded', function () {
    const openOptionsButton = document.getElementById('openOptions');
    const statusDiv = document.getElementById('status');

    // 버튼 클릭 시 설정 페이지 열기
    openOptionsButton.addEventListener('click', function () {
        chrome.runtime.openOptionsPage();
    });

    // API 모델 설정 상수 (popup에서도 필요)
    const AI_MODELS = {
        'openai-o4-mini': {
            id: 'openai-o4-mini',
            name: 'OpenAI o4-mini',
            provider: 'openai',
            apiKeyRequired: 'openai_api_key'
        },
        'gemini-2.5-pro': {
            id: 'gemini-2.5-pro',
            name: 'Google Gemini 2.5 Pro',
            provider: 'gemini',
            apiKeyRequired: 'gemini_api_key'
        },
        'gemini-3-pro-preview': {
            id: 'gemini-3-pro-preview',
            name: 'Google Gemini 3 Pro Preview',
            provider: 'gemini',
            apiKeyRequired: 'gemini_api_key'
        }
    };

    // API 키 및 모델 상태 확인
    chrome.storage.local.get(['openai_api_key', 'gemini_api_key', 'selected_ai_model'], function (result) {
        if (chrome.runtime.lastError) {
            console.error('설정 확인 오류:', chrome.runtime.lastError);
            statusDiv.textContent = '설정 확인 중 오류 발생';
            statusDiv.className = 'status-base status-error';
            statusDiv.style.display = 'block';
            return;
        }

        const selectedModel = result.selected_ai_model || 'openai-o4-mini';
        const modelConfig = AI_MODELS[selectedModel];

        if (modelConfig) {
            const requiredKey = modelConfig.apiKeyRequired === 'openai_api_key'
                ? result.openai_api_key
                : result.gemini_api_key;

            if (requiredKey && requiredKey.trim() !== '') {
                statusDiv.innerHTML = `
                    <div>✅ ${modelConfig.name} 모델 사용 중</div>
                    <div style="font-size: 0.9em; margin-top: 4px; opacity: 0.8;">API 키가 설정되었습니다</div>
                `;
                statusDiv.className = 'status-base status-success';
            } else {
                statusDiv.innerHTML = `
                    <div>⚠️ ${modelConfig.name} 모델 선택됨</div>
                    <div style="font-size: 0.9em; margin-top: 4px;">API 키가 필요합니다. 설정에서 구성해주세요</div>
                `;
                statusDiv.className = 'status-base status-warning';
            }
        } else {
            statusDiv.textContent = '설정에서 AI 모델을 선택해주세요';
            statusDiv.className = 'status-base status-warning';
        }

        statusDiv.style.display = 'block';
    });
});
