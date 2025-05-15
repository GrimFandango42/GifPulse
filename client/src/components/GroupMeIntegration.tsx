import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface GroupMeIntegrationProps {
  onGifButtonClick: () => void;
  selectedGif: string | null;
  onGifSent?: () => void;
}

interface ChatMessage {
  id: number;
  sender: string;
  text?: string;
  time: string;
  isCurrentUser: boolean;
  gif?: string | null;
  initial?: string;
  color?: string;
}

export default function GroupMeIntegration({ 
  onGifButtonClick, 
  selectedGif,
  onGifSent
}: GroupMeIntegrationProps) {
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      sender: "John",
      initial: "J",
      color: "bg-blue-500",
      text: "Hey everyone! Who's up for game night this weekend?",
      time: "2:05 PM",
      isCurrentUser: false
    },
    {
      id: 2,
      sender: "You",
      text: "I'm in! Let's do it!",
      time: "2:07 PM",
      isCurrentUser: true
    },
    {
      id: 3,
      sender: "Sarah",
      initial: "S",
      color: "bg-green-500",
      text: "Me too! Let's play the new board game I got.",
      time: "2:08 PM",
      isCurrentUser: false
    }
  ]);

  const handleSendMessage = () => {
    if (message.trim() || selectedGif) {
      const newMessage = {
        id: Date.now(),
        sender: "You",
        text: message.trim() ? message : undefined,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isCurrentUser: true,
        gif: selectedGif
      };
      
      setChatMessages([...chatMessages, newMessage]);
      setMessage("");
      
      // Notify parent that the GIF was sent
      if (selectedGif && onGifSent) {
        onGifSent();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div className="relative min-h-screen">
      {/* GroupMe App Mock Header */}
      <div className="bg-white shadow-md p-3 flex items-center justify-between fixed top-0 left-0 right-0 z-10">
        <div className="flex items-center">
          <button className="material-ripple p-1 rounded-full">
            <span className="material-icons">arrow_back</span>
          </button>
          <h1 className="ml-2 text-lg font-medium text-neutral-dark">My Friend Group</h1>
        </div>
        <div className="flex items-center">
          <button className="material-ripple p-1 rounded-full">
            <span className="material-icons">more_vert</span>
          </button>
        </div>
      </div>
      
      {/* GroupMe Chat Area Mock */}
      <div className="pt-14 pb-28 px-3">
        <div className="space-y-3 py-4">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isCurrentUser ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`${
                  msg.isCurrentUser 
                    ? 'bg-primary rounded-lg p-3 shadow-sm max-w-[80%]' 
                    : 'bg-white rounded-lg p-3 shadow-sm max-w-[80%] relative ml-8'
                }`}
              >
                {!msg.isCurrentUser && (
                  <div className={`absolute -left-8 top-0 w-8 h-8 rounded-full ${msg.color} flex items-center justify-center text-white`}>
                    {msg.initial}
                  </div>
                )}
                
                {msg.text && (
                  <p className={`${msg.isCurrentUser ? 'text-white' : 'text-neutral-dark'} text-sm`}>
                    {msg.text}
                  </p>
                )}
                
                {msg.gif && (
                  <div className="rounded overflow-hidden mt-1">
                    <img 
                      src={msg.gif} 
                      alt="Custom GIF" 
                      className="max-w-full w-full max-h-[250px] object-contain rounded" 
                    />
                  </div>
                )}
                
                <span className={`${msg.isCurrentUser ? 'text-white text-opacity-80' : 'text-neutral-medium'} text-xs mt-1`}>
                  {msg.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* GroupMe Message Input Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t border-gray-200 p-2">
        <div className="flex items-center">
          <button
            onClick={onGifButtonClick}
            className="material-ripple p-2 rounded-full flex items-center justify-center bg-neutral-light hover:bg-neutral-200 transition-colors"
            aria-label="Add GIF"
          >
            <span className="material-icons text-primary font-bold">gif</span>
            <span className="ml-1 text-sm font-medium text-primary">GIF</span>
          </button>
          <div className="flex-1 mx-2 bg-neutral-light rounded-full px-4 py-2">
            <Input
              type="text"
              placeholder="Message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent outline-none text-neutral-dark placeholder-neutral-medium text-sm border-none"
            />
          </div>
          <Button
            onClick={handleSendMessage}
            variant="ghost"
            className="material-ripple p-2 rounded-full"
          >
            <span className="material-icons text-primary">send</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
