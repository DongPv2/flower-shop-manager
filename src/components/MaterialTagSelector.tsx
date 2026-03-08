import React, { useState, useRef, useEffect } from 'react';
import { FaTimes, FaPlus } from 'react-icons/fa';

const MATERIAL_TAGS = [
  "Mao lương", "Tulip"
];

interface MaterialTagSelectorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

const MaterialTagSelector: React.FC<MaterialTagSelectorProps> = ({ selectedTags, onChange }) => {
  const [customTag, setCustomTag] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (customTag) {
      const filtered = MATERIAL_TAGS.filter(
        tag => tag.toLowerCase().includes(customTag.toLowerCase()) &&
          !selectedTags.includes(tag)
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [customTag, selectedTags]);

  const handleAddTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      onChange([...selectedTags, tag]);
    }
    setCustomTag('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChange(selectedTags.filter(tag => tag !== tagToRemove));
  };

  const handleCustomTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customTag.trim() && !selectedTags.includes(customTag.trim())) {
      handleAddTag(customTag.trim());
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleAddTag(suggestion);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nguyên vật liệu cần mua
        </label>

        {/* Selected Tags */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedTags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="text-green-600 hover:text-green-800"
                >
                  <FaTimes className="text-xs" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Predefined Tags */}
        <div className="mb-3">
          <p className="text-xs text-gray-600 mb-2">Tags thường dùng:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {MATERIAL_TAGS.slice(0, 12).map((tag) => (
              <label
                key={tag}
                className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
              >
                <input
                  type="checkbox"
                  checked={selectedTags.includes(tag)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleAddTag(tag);
                    } else {
                      handleRemoveTag(tag);
                    }
                  }}
                  className="rounded text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">{tag}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Custom Tag Input */}
        <div className="relative">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCustomTagSubmit(e);
                }
              }}
              placeholder="Nhập tag khác hoặc gõ để tìm kiếm..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={handleCustomTagSubmit}
              className="bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 transition"
            >
              <FaPlus />
            </button>
          </div>

          {/* Auto-complete Suggestions */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
              {filteredSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MaterialTagSelector;
