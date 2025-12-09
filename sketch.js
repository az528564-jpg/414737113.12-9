let sprites = {};
let currentKey = 'stance';
let frameW = 0, frameH = 0;
let currentFrame = 0;
let lastChange = 0;
const FRAME_INTERVAL = 100; // ms 每幀間隔

// 左側精靈動畫（獨立於目前角色動畫）
let leftAnimFrame = 0;
let leftAnimLastChange = 0;
const LEFT_FRAME_INTERVAL = 100; // ms
let leftFrameW = 0, leftFrameH = 0;

// 移動相關變數
let charX = 0; // 角色中心 X 位置
let charY = 0; // 角色中心 Y 位置
let velocityX = 0; // X 方向速度
let velocityY = 0; // Y 方向速度
const WALK_SPEED = 4; // 移動速度（像素/幀）
let isWalking = false; // 是否正在行走
let facingRight = true; // 角色朝向（true=右, false=左）

// 用來暫存切換前的 key，以便放開滑鼠還原
let prevKey = null;

// 題庫與對話相關變數
let questions = []; // CSV 題庫陣列
let currentQuestion = null; // 當前題目物件
let character2Dialogue = ''; // 精靈2顯示的對話文字
let userAnswer = ''; // 玩家輸入的答案
let dialogueState = 'idle'; // 'idle', 'question', 'answered'
let feedbackText = ''; // 回饋文字
let feedbackTime = 0; // 回饋顯示時間
const FEEDBACK_DURATION = 2000; // 回饋持續 2 秒

// 精靈2（左上角）的位置與碰撞範圍
let sprite2X = 0;
let sprite2Y = 0;
let sprite2W = 0;
let sprite2H = 0;
let collisionDetected = false; // 是否偵測到碰撞

// 精靈2 狀態（可切換顯示不同動畫）
let leftActiveKey = 'leftStand';
const leftCorrectKey = 'leftStandCorrect';
let sprite2IsCorrect = false; // 當答對時切換為 true
// 答對動畫播放計數（播放完整循環的次數）
let leftCorrectPlayCount = 0;
const LEFT_CORRECT_TARGET = 2; // 要播放幾次完整循環後還原

function preload() {
  // 主要站立精靈（10 幀）
  sprites['stance'] = {
    img: loadImage('1/stance/all.png'),
    frames: 10
  };

  // 右鍵按下時要切換的精靈（6 幀）
  sprites['walk'] = {
    img: loadImage('1/walk/all.png'),
    frames: 6
  };

  // slash 精靈（5 幀），來源檔案 1/slash/all.png，總寬 755 總高 140
  // 每格寬度 = 755 / 5 = 151
  sprites['slash'] = {
    img: loadImage('1/slash/all.png'),
    frames: 5,
    frameW: 755 / 5,
    frameH: 140
  };

  // 左側要顯示的額外動畫（來源：2/stand/all.png，12 幀）
  sprites['leftStand'] = {
    img: loadImage('2/stand/all.png'),
    frames: 12
  };

  // 答對後要切換的精靈動畫（來源：2/33/all.png，4 幀，總寬847 總高96）
  // 每格寬度 = 847 / 4
  sprites['leftStandCorrect'] = {
    img: loadImage('2/33/all.png'),
    frames: 4,
    frameW: 847 / 4,
    frameH: 96
  };

  // 載入 CSV 題庫
  loadQuestionsFromCSV();
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  noSmooth();
  updateFrameSize();
  lastChange = millis();
  charX = width / 2; // 初始位置：螢幕中央
  charY = height / 2;
}

// 從 CSV 載入題庫
function loadQuestionsFromCSV() {
  const csvData = `題目,答案,答對回饋,答錯回饋,提示
1+1,2,太棒了！答對了,答案不對喔,個位數相加
2+3,5,恭喜答對,再試試看,兩個數字相加
4+4,8,正確！,算算看,相同的數字相加
3+5,8,答對了！,不是這個答案,可以用手指數一數
2+6,8,太好了,再算一次,結果是8
7+1,8,完全正確,答案錯了,加上1
5+4,9,答對！,再想想,5和4相加
3+6,9,正確答案,不正確,個位數相加
1+8,9,太棒了,答案不對,1加8
2+2,4,答對了,再試試,2加2`;

  const lines = csvData.split('\n');
  const headers = lines[0].split(',');
  
  questions = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length === headers.length) {
      questions.push({
        題目: values[0],
        答案: values[1],
        答對回饋: values[2],
        答錯回饋: values[3],
        提示: values[4]
      });
    }
  }
}

function updateFrameSize() {
  const s = sprites[currentKey];
  if (s && s.img) {
    // 若 sprite 指定了固定寬高就用它，否則從圖檔計算
    if (typeof s.frameW !== 'undefined' && typeof s.frameH !== 'undefined') {
      frameW = s.frameW;
      frameH = s.frameH;
    } else {
      frameW = s.img.width / s.frames;
      frameH = s.img.height;
    }
  } else {
    frameW = frameH = 0;
  }
}

function draw() {
  background('#e6ccb2');

  const s = sprites[currentKey];
  if (!s || !s.img) return;

  // 更新動畫幀
  if (millis() - lastChange >= FRAME_INTERVAL) {
    currentFrame = (currentFrame + 1) % s.frames;
    lastChange = millis();
  }

  // --- 更新並繪製左側獨立動畫 ---
  const leftS = sprites[leftActiveKey];
  if (leftS && leftS.img) {
    // 計算左側每格寬高（lazy 計算）
    leftFrameW = leftS.img.width / leftS.frames;
    leftFrameH = leftS.img.height;

    if (millis() - leftAnimLastChange >= LEFT_FRAME_INTERVAL) {
      // 檢查是否發生一個循環的回轉（從最後一格回到 0）以計數完整播放次數
      const prevFrame = leftAnimFrame;
      const nextFrame = (leftAnimFrame + 1) % leftS.frames;
      leftAnimFrame = nextFrame;
      leftAnimLastChange = millis();

      // 只有在正在播放答對動畫時才計數回合
      if (leftActiveKey === leftCorrectKey) {
        if (prevFrame === leftS.frames - 1 && nextFrame === 0) {
          leftCorrectPlayCount++;
          // 達到目標播放次數時還原為原本動畫
          if (leftCorrectPlayCount >= LEFT_CORRECT_TARGET) {
            leftActiveKey = 'leftStand';
            sprite2IsCorrect = false;
            leftCorrectPlayCount = 0;
            leftAnimFrame = 0;
            leftAnimLastChange = millis();
          }
        }
      }
    }

    // 固定顯示在畫布左上角（padding 可調）
    const padding = 100;
    const leftDx = padding;
    const leftDy = padding;
    const leftSx = leftAnimFrame * leftFrameW;

    // 更新精靈2的碰撞範圍
    sprite2X = leftDx;
    sprite2Y = leftDy;
    sprite2W = leftFrameW;
    sprite2H = leftFrameH;

    // 計算精靈2是否應該朝向右邊（主角在精靈2右側）
    const sprite2CenterX = sprite2X + sprite2W / 2;
    const sprite2CenterY = sprite2Y + sprite2H / 2;
    const charCenterX = charX;
    const charCenterY = charY;
    const sprite2FacingRight = charCenterX > sprite2CenterX;

    // 繪製左側精靈（根據主角位置決定翻轉）
    push();
    translate(leftDx + leftFrameW / 2, leftDy + leftFrameH / 2);
    if (!sprite2FacingRight) {
      scale(-1, 1); // 朝向左邊
    }
    image(leftS.img, -leftFrameW / 2, -leftFrameH / 2, leftFrameW, leftFrameH, leftSx, 0, leftFrameW, leftFrameH);
    pop();
  }

  // 碰撞檢測：主角與精靈2是否碰撞
  checkCollision();
  
  // 若有回饋訊息且時間未過期，顯示回饋
  if (feedbackText && millis() - feedbackTime < FEEDBACK_DURATION) {
    fill(0);
    textSize(20);
    textAlign(CENTER);
    text(feedbackText, width / 2, height * 0.8);
  } else if (feedbackText && millis() - feedbackTime >= FEEDBACK_DURATION) {
    feedbackText = ''; // 清除回饋
  }
  
  // 顯示對話與輸入框（如果有題目被觸發）
  if (character2Dialogue) {
    // 題目顯示在精靈2上方
    fill(0);
    textSize(18);
    textAlign(CENTER);
    text(character2Dialogue, sprite2X + sprite2W / 2, sprite2Y - 30);
    
    // 在精靈1(主角)上方顯示輸入框（回答中或已回答都顯示）
    if (dialogueState === 'question' || dialogueState === 'answered') {
      drawInputBox();
    }
  }

  // 更新位置
  charX += velocityX;
  charY += velocityY;

  // 邊界限制：角色不能超出畫布左右/上下邊界
  const halfFrameW = frameW / 2;
  const halfFrameH = frameH / 2;
  if (charX - halfFrameW < 0) {
    charX = halfFrameW;
  }
  if (charX + halfFrameW > width) {
    charX = width - halfFrameW;
  }
  if (charY - halfFrameH < 0) {
    charY = halfFrameH;
  }
  if (charY + halfFrameH > height) {
    charY = height - halfFrameH;
  }

  const sx = currentFrame * frameW;

  // 繪製精靈
  const dx = charX - frameW / 2; // 左上角 X
  const dy = charY - frameH / 2; // 左上角 Y

  // 根據朝向繪製精靈
  push();
  // 使用 translate 以便翻轉時以角色中心為基準
  translate(charX, charY);
  if (!facingRight) {
    scale(-1, 1); // 翻轉向左
  }
  image(s.img, -frameW / 2, -frameH / 2, frameW, frameH, sx, 0, frameW, frameH);
  pop();
}


function keyReleased() {
  // 放開任何方向鍵時恢復站立精靈並停止相對方向的移動
  if (keyCode === RIGHT_ARROW || keyCode === LEFT_ARROW) {
    velocityX = 0;
  }
  if (keyCode === UP_ARROW || keyCode === DOWN_ARROW) {
    velocityY = 0;
  }

  // 若沒有任何方向鍵按著，回到站立精靈
  if (!keyIsDown(LEFT_ARROW) && !keyIsDown(RIGHT_ARROW) && !keyIsDown(UP_ARROW) && !keyIsDown(DOWN_ARROW)) {
    if (currentKey !== 'stance') {
      currentKey = 'stance';
      currentFrame = 0;
      updateFrameSize();
      lastChange = millis();
    }
    isWalking = false;
  }
}

// 當滑鼠按下時切換到 slash（僅處理左鍵）
function mousePressed() {
  if (mouseButton === LEFT) {
    // 暫存當前 key，之後放開還原
    prevKey = currentKey;
    currentKey = 'slash';
    currentFrame = 0;
    updateFrameSize();
    lastChange = millis();
  }
}

// 放開滑鼠左鍵還原到先前的精靈（若無暫存則回到 stance）
function mouseReleased() {
  if (mouseButton === LEFT) {
    const restore = prevKey || 'stance';
    // 若玩家同時按方向鍵則優先回到 walk
    if (keyIsDown(LEFT_ARROW) || keyIsDown(RIGHT_ARROW) || keyIsDown(UP_ARROW) || keyIsDown(DOWN_ARROW)) {
      currentKey = 'walk';
    } else {
      currentKey = restore;
    }
    currentFrame = 0;
    updateFrameSize();
    lastChange = millis();
    prevKey = null;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// 在精靈1上方繪製輸入框
function drawInputBox() {
  // 輸入框位置：在主角上方
  const boxX = charX - 100;
  const boxY = charY - frameH / 2 - 80;
  const boxW = 200;
  const boxH = 60;
  
  // 根據狀態決定背景顏色
  let bgColor;
  let isDisabled = false;
  if (dialogueState === 'answered') {
    bgColor = color(200, 200, 200); // 灰色表示已提交
    isDisabled = true;
  } else {
    bgColor = color(255, 255, 200); // 淡黃色表示可輸入
  }
  
  // 繪製背景框
  fill(bgColor);
  stroke(0);
  strokeWeight(2);
  rect(boxX, boxY, boxW, boxH, 5); // 圓角矩形
  
  // 繪製標題
  fill(0);
  textSize(14);
  textAlign(LEFT);
  text('回答問題:', boxX + 10, boxY + 20);
  
  // 繪製輸入區域背景
  fill(isDisabled ? 240 : 255);
  stroke(100);
  strokeWeight(1);
  rect(boxX + 10, boxY + 30, boxW - 20, 20);
  
  // 繪製輸入的答案文字
  fill(isDisabled ? 150 : 0);
  textSize(16);
  textAlign(LEFT);
  text(userAnswer, boxX + 15, boxY + 45);
  
  // 繪製閃爍的游標（只在回答中時顯示）
  if (!isDisabled && floor(millis() / 500) % 2 === 0) {
    stroke(0);
    strokeWeight(2);
    line(boxX + 15 + textWidth(userAnswer), boxY + 32, 
         boxX + 15 + textWidth(userAnswer), boxY + 52);
  }
  
  // 繪製提示文字
  fill(isDisabled ? 120 : 100);
  textSize(11);
  textAlign(CENTER);
  if (isDisabled) {
    text('回饋中...請稍候', boxX + boxW / 2, boxY + boxH - 5);
  } else {
    text('按 Enter 提交，Backspace 刪除', boxX + boxW / 2, boxY + boxH - 5);
  }
}

// 碰撞檢測：檢查主角是否與精靈2碰撞
function checkCollision() {
  // 使用 AABB (Axis-Aligned Bounding Box) 碰撞檢測
  const charHalfW = frameW / 2;
  const charHalfH = frameH / 2;
  const charLeft = charX - charHalfW;
  const charRight = charX + charHalfW;
  const charTop = charY - charHalfH;
  const charBottom = charY + charHalfH;

  const sprite2Left = sprite2X;
  const sprite2Right = sprite2X + sprite2W;
  const sprite2Top = sprite2Y;
  const sprite2Bottom = sprite2Y + sprite2H;

  const isColliding = !(charRight < sprite2Left || charLeft > sprite2Right ||
                        charBottom < sprite2Top || charTop > sprite2Bottom);

  if (isColliding && !collisionDetected) {
    // 新碰撞開始
    collisionDetected = true;
    if (questions.length > 0) {
      currentQuestion = questions[floor(random(questions.length))];
      character2Dialogue = currentQuestion.題目;
      dialogueState = 'question';
      userAnswer = '';
      feedbackText = '';
    }
  } else if (!isColliding && collisionDetected) {
    // 碰撞結束
    collisionDetected = false;
    character2Dialogue = '';
    dialogueState = 'idle';
    userAnswer = '';
  }
}

// 按鍵輸入處理
function keyPressed() {
  // 原有的方向鍵邏輯
  if (keyCode === RIGHT_ARROW) {
    if (currentKey !== 'walk') {
      currentKey = 'walk';
      currentFrame = 0;
      updateFrameSize();
      lastChange = millis();
    }
    isWalking = true;
    facingRight = true;
    velocityX = WALK_SPEED; // 向右移動
  } else if (keyCode === LEFT_ARROW) {
    if (currentKey !== 'walk') {
      currentKey = 'walk';
      currentFrame = 0;
      updateFrameSize();
      lastChange = millis();
    }
    isWalking = true;
    facingRight = false;
    velocityX = -WALK_SPEED; // 向左移動
  } else if (keyCode === UP_ARROW) {
    if (currentKey !== 'walk') {
      currentKey = 'walk';
      currentFrame = 0;
      updateFrameSize();
      lastChange = millis();
    }
    isWalking = true;
    velocityY = -WALK_SPEED; // 向上移動
  } else if (keyCode === DOWN_ARROW) {
    if (currentKey !== 'walk') {
      currentKey = 'walk';
      currentFrame = 0;
      updateFrameSize();
      lastChange = millis();
    }
    isWalking = true;
    velocityY = WALK_SPEED; // 向下移動
  }
  // 答題相關鍵位
  else if (dialogueState === 'question') {
    if (keyCode === ENTER) {
      // 提交答案（移除多餘空白後比對）
      const trimmedAnswer = userAnswer.trim();
      if (trimmedAnswer === currentQuestion.答案.trim()) {
        feedbackText = currentQuestion.答對回饋;
        // 切換精靈2 到答對動畫
        leftActiveKey = leftCorrectKey;
        sprite2IsCorrect = true;
        // 重新啟動左側動畫幀計時
        leftAnimFrame = 0;
        leftAnimLastChange = millis();
      } else {
        feedbackText = currentQuestion.答錯回饋 + ' (答案是: ' + currentQuestion.答案 + ')';
      }
      feedbackTime = millis();
      userAnswer = '';
      dialogueState = 'answered';
    } else if (keyCode === DELETE || keyCode === BACKSPACE) {
      // 刪除輸入（Backspace）
      userAnswer = userAnswer.slice(0, -1);
    } else if (key && key.length === 1) {
      // 接受任何單一字符（數字、加號、減號等）
      const allowedChars = '0123456789+-';
      if (allowedChars.includes(key)) {
        userAnswer += key;
      }
    }
  }
}
