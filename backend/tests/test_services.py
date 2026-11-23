from app.services import severity_score, green_priority_demo, chatbot_answer
from app.schemas import ChatRequest

def test_severity_is_provisional():
    result = severity_score(30, 60)
    assert result["score"] is not None
    assert result["provisional"] is True
    assert "not CPCB AQI" in result["method"]

def test_green_priority_sorted():
    items = green_priority_demo()
    assert items[0]["score"] >= items[-1]["score"]
    assert "Illustrative" in items[0]["label"]

def test_chatbot_uses_context():
    result = chatbot_answer(ChatRequest(message="why is it worsening?", location="Solan", pm25=42))
    assert "Solan" in result["answer"]
    assert "42" in result["answer"]
