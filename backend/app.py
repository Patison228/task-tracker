from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from functools import wraps
from datetime import datetime, timedelta
from models import db, User, Board, Column, Task
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///task-tracker.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = '12345'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=1)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)

db.init_app(app)
CORS(app, supports_credentials=True)

# Создание таблиц
with app.app_context():
    db.create_all()

# Декоратор для проверки access токена
def token_required(f):
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
            return jsonify({'message': 'Токен отсутствует'}), 401
        
        try:
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

# Декоратор для проверки refresh токена
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

# Функция создания токенов
def create_tokens(user_id):
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

# Регистрация
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if User.query.filter_by(username=username).first():
        return jsonify({'message': 'Пользователь уже существует'}), 400

    user = User(username=username, password_hash=generate_password_hash(password))
    db.session.add(user)
    db.session.commit()

    return jsonify({'message': 'Пользователь создан успешно'}), 201

# Логин
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    user = User.query.filter_by(username=username).first()
    if user and check_password_hash(user.password_hash, password):
        access_token, refresh_token = create_tokens(user.id)
        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': {'id': user.id, 'username': user.username}
        })

    return jsonify({'message': 'Неверный логин или пароль'}), 401

# Обновление access token по refresh token
@app.route('/refresh', methods=['POST'])
@refresh_token_required
def refresh(current_user):
    access_token, new_refresh_token = create_tokens(current_user.id)
    return jsonify({
        'access_token': access_token,
        'refresh_token': new_refresh_token
    })


@app.route('/boards', methods=['GET'])
@token_required
def get_boards(current_user):
    boards = Board.query.filter_by(owner_id=current_user.id).order_by(Board.id.desc()).all()
    return jsonify([{'id': b.id, 'title': b.title} for b in boards])

@app.route('/boards', methods=['POST'])
@token_required
def create_board(current_user):
    data = request.get_json()
    board = Board(title=data['title'], owner_id=current_user.id)
    db.session.add(board)
    db.session.commit()
    return jsonify({'id': board.id, 'title': board.title}), 201
    
@app.route('/boards/<int:board_id>/columns', methods=['GET'])
@token_required
def get_columns(current_user, board_id):
    board = Board.query.filter_by(id=board_id, owner_id=current_user.id).first()
    if not board:
        return jsonify({'message': 'Доска не найдена'}), 404
    
    columns = Column.query.filter_by(board_id=board_id).order_by(Column.position).all()
    return jsonify([{'id': c.id, 'title': c.title, 'position': c.position} for c in columns])

@app.route('/boards/<int:board_id>/columns', methods=['POST'])
@token_required
def create_column(current_user, board_id):
    board = Board.query.filter_by(id=board_id, owner_id=current_user.id).first()
    if not board:
        return jsonify({'message': 'Доска не найдена'}), 404
    
    data = request.get_json()
    max_pos = db.session.query(db.func.max(Column.position)).filter_by(board_id=board_id).scalar() or 0
    column = Column(title=data['title'], position=max_pos + 1, board_id=board_id)
    db.session.add(column)
    db.session.commit()
    return jsonify({'id': column.id, 'title': column.title, 'position': column.position}), 201

@app.route('/columns/<int:column_id>/tasks', methods=['GET'])
@token_required
def get_tasks(current_user, column_id):
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
        'column_id': t.column_id
    } for t in tasks])

@app.route('/columns/<int:column_id>/tasks', methods=['POST'])
@token_required
def create_task(current_user, column_id):
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
        description=data.get('description'), 
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

@app.route('/tasks/<int:task_id>', methods=['PUT'])
@token_required
def update_task(current_user, task_id):
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

@app.route('/tasks/<int:task_id>', methods=['DELETE'])
@token_required
def delete_task(current_user, task_id):
    task = Task.query.join(Column).join(Board).filter(
        Task.id == task_id,
        Board.owner_id == current_user.id
    ).first()
    
    if not task:
        return jsonify({'message': 'Задача не найдена'}), 404
    
    db.session.delete(task)
    db.session.commit()
    return jsonify({'message': 'Задача удалена'})

# Эндпоинт для обновления колонки
@app.route('/columns/<int:column_id>', methods=['PUT'])
@token_required
def update_column(current_user, column_id):
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

# Эндпоинт для удаления колонки
@app.route('/columns/<int:column_id>', methods=['DELETE'])
@token_required
def delete_column(current_user, column_id):
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


@app.route('/boards/<int:board_id>', methods=['DELETE'])
@token_required
def delete_board(current_user, board_id):
    board = Board.query.filter_by(id=board_id, owner_id=current_user.id).first()
    
    if not board:
        return jsonify({'message': 'Доска не найдена'}), 404
    
    db.session.delete(board)
    db.session.commit()
    return jsonify({'message': 'Доска удалена'})

@app.route('/tasks/<int:task_id>/move', methods=['POST'])
@token_required
def move_task(current_user, task_id):
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

# Проверяем, находимся ли мы в production режиме
FRONTEND_BUILD_PATH = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'build')

# Если build папка существует (production), сервируем frontend
if os.path.exists(FRONTEND_BUILD_PATH):
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        # Если путь существует в build папке, вернём статический файл
        if path and os.path.isfile(os.path.join(FRONTEND_BUILD_PATH, path)):
            return send_from_directory(FRONTEND_BUILD_PATH, path)
        
        # Для всех остальных маршрутов вернём index.html (для SPA)
        return send_from_directory(FRONTEND_BUILD_PATH, 'index.html')

if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_ENV') != 'production'
    app.run(debug=debug_mode, host='0.0.0.0', port=5000)

