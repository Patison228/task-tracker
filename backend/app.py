from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.exceptions import NotFound
import jwt
from functools import wraps
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# ===== ЗАГРУЗКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ =====
# Загружаем из .env файла (или используем defaults)
load_dotenv()

from models import db, User, Board, Column, Task

# ===== FLASK КОНФИГУРАЦИЯ =====
# Определяем режим (development или production)
FLASK_ENV = os.getenv('FLASK_ENV', 'development')

# Для production: раздаём собранный фронтенд
# Для development: НЕ раздаём (Vite dev server раздаёт сам)
static_folder = None
if FLASK_ENV == 'production':
    static_folder = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')

app = Flask(
    __name__,
    static_folder=static_folder,
    static_url_path='/'
)

# ===== DATABASE КОНФИГУРАЦИЯ =====
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    'DATABASE_URL',
    'sqlite:///task-tracker.db'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# ===== JWT КОНФИГУРАЦИЯ =====
app.config['JWT_SECRET_KEY'] = os.getenv(
    'JWT_SECRET_KEY',
    'change-this-in-production'
)
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(minutes=30)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)

# Инициализируем БД
db.init_app(app)

# ===== CORS КОНФИГУРАЦИЯ =====
# ПОЧЕМУ это нужно:
# - Frontend на localhost:3000, backend на 5000 - разные origins
# - Браузер блокирует запросы между разными origins (Same-Origin Policy)
# - CORS разрешает frontend обращаться к backend
cors_origins = os.getenv(
    'CORS_ORIGINS',
    'http://localhost:3000'  # development default
).split(',')

CORS(
    app,
    origins=cors_origins,
    supports_credentials=True,
    allow_headers=['Content-Type', 'Authorization'],
    methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
)

# ===== ИНИЦИАЛИЗАЦИЯ БД =====
with app.app_context():
    db.create_all()

# ===== HEALTH CHECK ENDPOINT =====
# Используется Docker для проверки живости контейнера
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200

# ===== ДЕКОРАТОР: Проверка Access Token =====
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Пытаемся получить токен из заголовка Authorization
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                # Формат: "Bearer <token>"
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'message': 'Неверный формат токена'}), 401
        
        if not token:
            return jsonify({'message': 'Токен отсутствует'}), 401
        
        try:
            # Декодируем JWT токен
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.get(data['user_id'])
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Токен истек'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Неверный токен'}), 401
        
        if not current_user:
            return jsonify({'message': 'Пользователь не найден'}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated


# ===== ДЕКОРАТОР: Проверка Refresh Token =====
def refresh_token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'message': 'Неверный формат токена'}), 401
        
        if not token:
            return jsonify({'message': 'Refresh токен отсутствует'}), 401
        
        try:
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=["HS256"])
            # Проверяем что это именно refresh токен
            if data.get('type') != 'refresh':
                return jsonify({'message': 'Это не refresh токен'}), 401
            current_user = User.query.get(data['user_id'])
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Refresh токен истек'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Неверный refresh токен'}), 401
        
        if not current_user:
            return jsonify({'message': 'Пользователь не найден'}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated


# ===== ФУНКЦИЯ: Создание JWT токенов =====
def create_tokens(user_id):
    """
    Создаёт access и refresh токены для пользователя
    
    Access token - короткоживущий (30 минут)
    Refresh token - долгоживущий (30 дней) для получения новых access токенов
    """
    access_token = jwt.encode({
        'user_id': user_id,
        'type': 'access',
        'exp': datetime.utcnow() + app.config['JWT_ACCESS_TOKEN_EXPIRES']
    }, app.config['JWT_SECRET_KEY'], algorithm="HS256")
    
    refresh_token = jwt.encode({
        'user_id': user_id,
        'type': 'refresh',
        'exp': datetime.utcnow() + app.config['JWT_REFRESH_TOKEN_EXPIRES']
    }, app.config['JWT_SECRET_KEY'], algorithm="HS256")
    
    return access_token, refresh_token


# ===== AUTH ENDPOINTS (с префиксом /api) =====

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Регистрация нового пользователя"""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    # Проверяем что пользователь не существует
    if User.query.filter_by(username=username).first():
        return jsonify({'message': 'Пользователь уже существует'}), 400

    # Создаём нового пользователя
    user = User(username=username, password_hash=generate_password_hash(password))
    db.session.add(user)
    db.session.commit()

    return jsonify({'message': 'Пользователь создан успешно'}), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    """Логин пользователя - выдаёт access и refresh токены"""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    # Ищем пользователя и проверяем пароль
    user = User.query.filter_by(username=username).first()
    if user and check_password_hash(user.password_hash, password):
        access_token, refresh_token = create_tokens(user.id)
        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': {'id': user.id, 'username': user.username}
        })

    return jsonify({'message': 'Неверный логин или пароль'}), 401


@app.route('/api/auth/refresh', methods=['POST'])
@refresh_token_required
def refresh(current_user):
    """Получить новый access token по refresh токену"""
    access_token, new_refresh_token = create_tokens(current_user.id)
    return jsonify({
        'access_token': access_token,
        'refresh_token': new_refresh_token
    })


# ===== энпоинты доски =====

@app.route('/api/boards', methods=['GET'])
@token_required
def get_boards(current_user):
    """Получить все доски текущего пользователя"""
    boards = Board.query.filter_by(owner_id=current_user.id).order_by(Board.id.desc()).all()
    return jsonify([{'id': b.id, 'title': b.title} for b in boards])


@app.route('/api/boards', methods=['POST'])
@token_required
def create_board(current_user):
    """Создать новую доску"""
    data = request.get_json()
    board = Board(title=data['title'], owner_id=current_user.id)
    db.session.add(board)
    db.session.commit()
    return jsonify({'id': board.id, 'title': board.title}), 201


@app.route('/api/boards/<int:board_id>', methods=['DELETE'])
@token_required
def delete_board(current_user, board_id):
    """Удалить доску"""
    board = Board.query.filter_by(id=board_id, owner_id=current_user.id).first()
    
    if not board:
        return jsonify({'message': 'Доска не найдена'}), 404
    

    db.session.delete(board)
    db.session.commit()
    return jsonify({'message': 'Доска удалена'})


# ===== эндпоинты колонок =====

@app.route('/api/boards/<int:board_id>/columns', methods=['GET'])
@token_required
def get_columns(current_user, board_id):
    """Получить все колонки доски"""
    board = Board.query.filter_by(id=board_id, owner_id=current_user.id).first()
    if not board:
        return jsonify({'message': 'Доска не найдена'}), 404
    
    columns = Column.query.filter_by(board_id=board_id).order_by(Column.position).all()
    return jsonify([{'id': c.id, 'title': c.title, 'position': c.position} for c in columns])


@app.route('/api/boards/<int:board_id>/columns', methods=['POST'])
@token_required
def create_column(current_user, board_id):
    """Создать новую колонку на доске"""
    board = Board.query.filter_by(id=board_id, owner_id=current_user.id).first()
    if not board:
        return jsonify({'message': 'Доска не найдена'}), 404
    
    data = request.get_json()
    max_pos = db.session.query(db.func.max(Column.position)).filter_by(board_id=board_id).scalar() or 0
    column = Column(title=data['title'], position=max_pos + 1, board_id=board_id)
    db.session.add(column)
    db.session.commit()
    return jsonify({'id': column.id, 'title': column.title, 'position': column.position}), 201


@app.route('/api/columns/<int:column_id>', methods=['PUT'])
@token_required
def update_column(current_user, column_id):
    """Обновить колонку"""
    column = Column.query.join(Board).filter(
        Column.id == column_id,
        Board.owner_id == current_user.id
    ).first()
    
    if not column:
        return jsonify({'message': 'Колонка не найдена'}), 404
    
    data = request.get_json()
    
    if 'title' in data:
        column.title = data['title']
    if 'position' in data:
        column.position = data['position']
    
    db.session.commit()
    return jsonify({
        'id': column.id,
        'title': column.title,
        'position': column.position,
        'board_id': column.board_id
    })


@app.route('/api/columns/<int:column_id>', methods=['DELETE'])
@token_required
def delete_column(current_user, column_id):
    """Удалить колонку"""
    column = Column.query.join(Board).filter(
        Column.id == column_id,
        Board.owner_id == current_user.id
    ).first()
    
    if not column:
        return jsonify({'message': 'Колонка не найдена'}), 404
    
    Task.query.filter_by(column_id=column_id).delete()
    db.session.delete(column)
    db.session.commit()
    return jsonify({'message': 'Колонка удалена'})


# ===== эндпоинты задач =====

@app.route('/api/columns/<int:column_id>/tasks', methods=['GET'])
@token_required
def get_tasks(current_user, column_id):
    """Получить все задачи в колонке"""
    column = Column.query.join(Board).filter(
        Column.id == column_id,
        Board.owner_id == current_user.id
    ).first()
    
    if not column:
        return jsonify({'message': 'Колонка не найдена'}), 404
    
    tasks = Task.query.filter_by(column_id=column_id).order_by(Task.position).all()
    return jsonify([{
        'id': t.id, 
        'title': t.title, 
        'description': t.description, 
        'position': t.position,
        'column_id': t.column_id,
        'created_at': t.created_at.isoformat() if hasattr(t, 'created_at') else None
    } for t in tasks])


@app.route('/api/columns/<int:column_id>/tasks', methods=['POST'])
@token_required
def create_task(current_user, column_id):
    """Создать новую задачу в колонке"""
    column = Column.query.join(Board).filter(
        Column.id == column_id,
        Board.owner_id == current_user.id
    ).first()
    
    if not column:
        return jsonify({'message': 'Колонка не найдена'}), 404
    
    data = request.get_json()
    max_pos = db.session.query(db.func.max(Task.position)).filter_by(column_id=column_id).scalar() or 0
    task = Task(
        title=data['title'], 
        description=data.get('description', ''), 
        position=max_pos + 1, 
        column_id=column_id
    )
    db.session.add(task)
    db.session.commit()
    return jsonify({
        'id': task.id, 
        'title': task.title, 
        'description': task.description, 
        'position': task.position,
        'column_id': task.column_id
    }), 201


@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
@token_required
def update_task(current_user, task_id):
    """Обновить задачу"""
    task = Task.query.join(Column).join(Board).filter(
        Task.id == task_id,
        Board.owner_id == current_user.id
    ).first()
    
    if not task:
        return jsonify({'message': 'Задача не найдена'}), 404
    
    data = request.get_json()
    
    if 'title' in data:
        task.title = data['title']
    if 'description' in data:
        task.description = data['description']
    if 'column_id' in data:
        new_column = Column.query.join(Board).filter(
            Column.id == data['column_id'],
            Board.owner_id == current_user.id
        ).first()
        if new_column:
            task.column_id = data['column_id']
    if 'position' in data:
        task.position = data['position']
    
    db.session.commit()
    return jsonify({
        'id': task.id,
        'title': task.title,
        'description': task.description,
        'position': task.position,
        'column_id': task.column_id
    })


@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
@token_required
def delete_task(current_user, task_id):
    """Удалить задачу"""
    task = Task.query.join(Column).join(Board).filter(
        Task.id == task_id,
        Board.owner_id == current_user.id
    ).first()
    
    if not task:
        return jsonify({'message': 'Задача не найдена'}), 404
    
    db.session.delete(task)
    db.session.commit()
    return jsonify({'message': 'Задача удалена'})


@app.route('/api/tasks/<int:task_id>/move', methods=['POST'])
@token_required
def move_task(current_user, task_id):
    """Переместить задачу влево/вправо между колонками"""
    task = Task.query.join(Column).join(Board).filter(
        Task.id == task_id,
        Board.owner_id == current_user.id
    ).first()
    
    if not task:
        return jsonify({'message': 'Задача не найдена'}), 404
    
    data = request.get_json()
    direction = data.get('direction') 
    
    column = Column.query.get(task.column_id)
    board_columns = Column.query.filter_by(board_id=column.board_id).order_by(Column.position).all()
    
    current_index = next((i for i, col in enumerate(board_columns) if col.id == task.column_id), -1)
    
    if direction == 'left' and current_index > 0:

        target_column = board_columns[current_index - 1]
        target_tasks_count = Task.query.filter_by(column_id=target_column.id).count()
        
        task.column_id = target_column.id
        task.position = target_tasks_count
        
    elif direction == 'right' and current_index < len(board_columns) - 1:

        target_column = board_columns[current_index + 1]
        target_tasks_count = Task.query.filter_by(column_id=target_column.id).count()
        
        task.column_id = target_column.id
        task.position = target_tasks_count
        
    else:
        return jsonify({'message': 'Невозможно переместить задачу в этом направлении'}), 400
    
    db.session.commit()
    
    source_tasks = Task.query.filter_by(column_id=column.id).order_by(Task.position).all()
    for idx, source_task in enumerate(source_tasks):
        source_task.position = idx
    
    db.session.commit()
    
    return jsonify({
        'id': task.id,
        'title': task.title,
        'description': task.description,
        'position': task.position,
        'column_id': task.column_id
    })


if FLASK_ENV == 'production':
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_react(path):

        if path.startswith('api/'):
            raise NotFound()
        
        # Проверяем что это существующий static файл
        if path and os.path.isfile(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        
        return send_from_directory(app.static_folder, 'index.html')


if __name__ == '__main__':
    debug = FLASK_ENV == 'development'
    app.run(debug=debug, host='0.0.0.0', port=5000)