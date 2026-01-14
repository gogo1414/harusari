-- 기본 카테고리 시드 데이터
-- 새 사용자 가입 시 트리거로 자동 생성됨

-- 기본 카테고리 생성 함수
CREATE OR REPLACE FUNCTION create_default_categories()
RETURNS TRIGGER AS $$
BEGIN
  -- 지출 카테고리
  INSERT INTO categories (user_id, name, type, icon, is_default) VALUES
    (NEW.id, '식비', 'expense', '🍔', true),
    (NEW.id, '교통', 'expense', '🚌', true),
    (NEW.id, '주거', 'expense', '🏠', true),
    (NEW.id, '통신', 'expense', '📱', true),
    (NEW.id, '생활용품', 'expense', '🛒', true),
    (NEW.id, '의류', 'expense', '👕', true),
    (NEW.id, '카페', 'expense', '☕', true),
    (NEW.id, '여가', 'expense', '🎮', true),
    (NEW.id, '의료', 'expense', '💊', true),
    (NEW.id, '교육', 'expense', '📚', true),
    (NEW.id, '기타', 'expense', '💰', true);

  -- 수입 카테고리
  INSERT INTO categories (user_id, name, type, icon, is_default) VALUES
    (NEW.id, '급여', 'income', '💼', true),
    (NEW.id, '부수입', 'income', '💵', true),
    (NEW.id, '투자수익', 'income', '📈', true),
    (NEW.id, '용돈', 'income', '🎁', true),
    (NEW.id, '기타', 'income', '💰', true);

  -- 기본 사용자 설정 생성
  INSERT INTO user_settings (user_id) VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 신규 사용자 가입 시 트리거
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_categories();
