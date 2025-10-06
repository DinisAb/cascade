// src/App.tsx
import React from 'react';
import useFileProcessor from './hooks/useFileProcessor';
import FileUploader from './components/FileUploader';
import FileConfirmation from './components/FileConfirmation';
import ResultsView from './components/ResultsView';

const App: React.FC = () => {
  const [state, actions] = useFileProcessor();
  const MAX_VISIBLE_ROWS = 1000;

  const isLoadingOrAnalyzing = state.loading || state.analysisComplete;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col items-center py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 text-center mx-auto">Анализ каскадов VK / SMS / WhatsApp</h1>

      {!state.analysisComplete && (
        <div className="w-full max-w-2xl space-y-4">
          {/* Статус загрузки файлов */}
          {state.smsVkLoaded && <div className="p-3 bg-blue-100 rounded-xl text-center">✅ Файл SMS/VK загружен</div>}
          {state.whatsappLoaded && <div className="p-3 bg-green-100 rounded-xl text-center">✅ Файл WhatsApp загружен</div>}

          {/* Компонент загрузки или подтверждения */}
          {(!state.smsVkLoaded || !state.whatsappLoaded) && !isLoadingOrAnalyzing && (
            <FileUploader
              onFileUpload={actions.handleFileUpload}
              disabled={state.loading}
              smsVkLoaded={state.smsVkLoaded}
              whatsappLoaded={state.whatsappLoaded}
            />
          )}

          {((state.smsVkLoaded && !state.whatsappLoaded) || (!state.smsVkLoaded && state.whatsappLoaded)) && !isLoadingOrAnalyzing && (
            <FileConfirmation
              smsVkLoaded={state.smsVkLoaded}
              whatsappLoaded={state.whatsappLoaded}
              onStartAnalysis={actions.startAnalysis}
              onFileUpload={actions.handleFileUpload}
              disabled={state.loading}
            />
          )}
        </div>
      )}

      {/* Анимация загрузки */}
      {state.loading && !state.analysisComplete && (
        <div className="flex flex-col items-center justify-center mt-20 w-full max-w-md">
          <div className="w-16 h-16 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-lg text-gray-700 animate-pulse">Обработка данных...</p>
          {state.progress > 0 && <p className="text-sm text-gray-500">Прогресс: {state.progress}%</p>}
          {state.estimatedTime && <p className="text-sm text-gray-500">Осталось: {state.estimatedTime}</p>}
          {state.progress > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${state.progress}%` }}></div>
            </div>
          )}
        </div>
      )}

      {/* Результаты */}
      {state.analysisComplete && (
        <ResultsView
          state={state}
          onExport={actions.exportToExcel}
          MAX_VISIBLE_ROWS={MAX_VISIBLE_ROWS}
        />
      )}
    </div>
  );
};

export default App;