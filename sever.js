const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let dragon = { hp: 100000, maxHp: 100000 };
let users = {};

// 1초마다 자동 골드 수급 (방치형)
setInterval(() => {
  Object.values(users).forEach(u => {
    u.gold += 5;
  });
  io.emit('updateUsers', users);
}, 1000);

io.on('connection', (socket) => {
  socket.emit('init', { dragon, users });

  socket.on('join', (nickname) => {
    users[socket.id] = {
      id: socket.id,
      nickname: nickname || '무명 용사',
      gold: 100,
      damage: 10,
      totalDamage: 0,
      weapon: '녹슨 단검',
      usedCoupons: []
    };
    io.emit('updateUsers', users);
  });

  socket.on('attack', () => {
    const u = users[socket.id];
    if (!u) return;

    dragon.hp = Math.max(0, dragon.hp - u.damage);
    u.totalDamage += u.damage;
    u.gold += 10;

    io.emit('updateDragon', dragon);
    io.emit('updateUsers', users);
  });

  // 쿠폰 시스템 (JYissmart140123)
  socket.on('useCoupon', (code) => {
    const u = users[socket.id];
    if (!u) return;

    if (code.trim() === 'JYissmart140123') {
      if (u.usedCoupons.includes('JYissmart140123')) {
        socket.emit('notify', '⚠️ 이미 사용한 쿠폰입니다!');
        return;
      }
      u.gold += 100;
      u.weapon = '📖 지혜의 마도서 (+50)';
      u.damage = 50;
      u.usedCoupons.push('JYissmart140123');

      socket.emit('notify', '🎁 쿠폰 적용! 100골드 & [📖 지혜의 마도서] 지급!');
      io.emit('updateUsers', users);
    } else {
      socket.emit('notify', '❌ 유효하지 않은 쿠폰입니다.');
    }
  });

  // 무기 뽑기
  socket.on('gacha', () => {
    const u = users[socket.id];
    if (!u) return;

    if (u.gold < 50) {
      socket.emit('notify', '❌ 골드가 부족합니다! (필요: 50골드)');
      return;
    }

    u.gold -= 50;
    const rand = Math.random();
    let weapon = '';
    let addDmg = 0;

    if (rand < 0.5) { weapon = '🗡️ 낡은 숏소드 (+10)'; addDmg = 10; }
    else if (rand < 0.8) { weapon = '⚔️ 강철 대검 (+30)'; addDmg = 30; }
    else if (rand < 0.95) { weapon = '🔥 화염의 마법검 (+80)'; addDmg = 80; }
    else { weapon = '🐉 드래곤 슬레이어 (+250)'; addDmg = 250; }

    u.weapon = weapon;
    u.damage = 10 + addDmg;

    socket.emit('notify', `🎉 [${weapon}] 뽑기 성공!`);
    io.emit('updateUsers', users);
  });

  // GM 관리자 조작 (코인/공격력/랭킹)
  socket.on('adminAction', ({ targetId, action, value }) => {
    const target = users[targetId];
    if (!target) return;

    const numValue = parseInt(value) || 0;

    if (action === 'addGold') {
      target.gold += numValue;
      io.emit('notify', `👑 GM이 [${target.nickname}] 님에게 ${numValue} 골드를 지급했습니다!`);
    } else if (action === 'setDamage') {
      target.damage = numValue;
      io.emit('notify', `👑 GM이 [${target.nickname}] 님의 공격력을 ${numValue}(으)로 변경했습니다!`);
    } else if (action === 'setRankDamage') {
      target.totalDamage = numValue;
      io.emit('notify', `👑 GM이 [${target.nickname}] 님의 누적 딜량을 ${numValue}(으)로 조작했습니다!`);
    }

    io.emit('updateUsers', users);
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
    io.emit('updateUsers', users);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
