<<<<<<< HEAD
<<<<<<< HEAD
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, create_refresh_token, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import timedelta

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///trello.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = '12345'  
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(minutes=15)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)

db = SQLAlchemy(app)
jwt = JWTManager(app)

# Модели
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)

class Board(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

class Column(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(50), nullable=False)
    position = db.Column(db.Integer, nullable=False)
    board_id = db.Column(db.Integer, db.ForeignKey('board.id'), nullable=False)

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    position = db.Column(db.Integer, nullable=False)
    column_id = db.Column(db.Integer, db.ForeignKey('column.id'), nullable=False)

# Создание таблиц (запустите один раз)
=======
from flask import Flask, request, jsonify, send_from_directory
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, create_refresh_token, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
import os
from datetime import timedelta
from models import db, User, Board, Column, Task

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///task_tracker.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'secret-key'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(minutes=30)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)

db.init_app(app)
jwt = JWTManager(app)

# Создание таблиц
>>>>>>> a130927 (Добавить login и register api эндпоинты)
with app.app_context():
    db.create_all()

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

<<<<<<< HEAD
    return jsonify({'message': 'Пользователь создан'}), 201
=======
    return jsonify({'message': 'Пользователь создан успешно'}), 201
>>>>>>> a130927 (Добавить login и register api эндпоинты)

# Логин
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    user = User.query.filter_by(username=username).first()
    if user and check_password_hash(user.password_hash, password):
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        return jsonify({
            'access_token': access_token,
<<<<<<< HEAD
            'refresh_token': refresh_token
        })

    return jsonify({'message': 'Неверные учетные данные'}), 401
=======
            'refresh_token': refresh_token,
            'user': {'id': user.id, 'username': user.username}
        })

    return jsonify({'message': 'Неверный логин или пароль'}), 401
>>>>>>> a130927 (Добавить login и register api эндпоинты)

# Обновление access token
@app.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    access_token = create_access_token(identity=identity)
    return jsonify({'access_token': access_token})

<<<<<<< HEAD
# Boards (доски)
@app.route('/boards', methods=['GET'])
@jwt_required()
def get_boards():
    user_id = get_jwt_identity()
    boards = Board.query.filter_by(owner_id=user_id).all()
    return jsonify([{'id': b.id, 'title': b.title} for b in boards])

@app.route('/boards', methods=['POST'])
@jwt_required()
def create_board():
    data = request.get_json()
    user_id = get_jwt_identity()
    board = Board(title=data['title'], owner_id=user_id)
    db.session.add(board)
    db.session.commit()
    return jsonify({'id': board.id, 'title': board.title}), 201

# Columns (колонки)
@app.route('/boards/<int:board_id>/columns', methods=['GET'])
@jwt_required()
def get_columns(board_id):
    columns = Column.query.filter_by(board_id=board_id).order_by(Column.position).all()
    return jsonify([{'id': c.id, 'title': c.title, 'position': c.position} for c in columns])

@app.route('/boards/<int:board_id>/columns', methods=['POST'])
@jwt_required()
def create_column(board_id):
    data = request.get_json()
    max_pos = db.session.query(db.func.max(Column.position)).filter_by(board_id=board_id).scalar() or 0
    column = Column(title=data['title'], position=max_pos + 1, board_id=board_id)
    db.session.add(column)
    db.session.commit()
    return jsonify({'id': column.id, 'title': column.title, 'position': column.position}), 201

# Tasks (задачи)
@app.route('/columns/<int:column_id>/tasks', methods=['GET'])
@jwt_required()
def get_tasks(column_id):
    tasks = Task.query.filter_by(column_id=column_id).order_by(Task.position).all()
    return jsonify([{'id': t.id, 'title': t.title, 'description': t.description, 'position': t.position} for t in tasks])

@app.route('/columns/<int:column_id>/tasks', methods=['POST'])
@jwt_required()
def create_task(column_id):
    data = request.get_json()
    max_pos = db.session.query(db.func.max(Task.position)).filter_by(column_id=column_id).scalar() or 0
    task = Task(title=data['title'], description=data.get('description'), position=max_pos + 1, column_id=column_id)
    db.session.add(task)
    db.session.commit()
    return jsonify({'id': task.id, 'title': task.title, 'description': task.description, 'position': task.position}), 201

# Перемещение задачи (обновление)
@app.route('/tasks/<int:task_id>', methods=['PUT'])
@jwt_required()
def update_task(task_id):
    task = Task.query.get_or_404(task_id)
    data = request.get_json()
    if 'column_id' in data:
        task.column_id = data['column_id']
    if 'position' in data:
        task.position = data['position']
    if 'title' in data:
        task.title = data['title']
    if 'description' in data:
        task.description = data['description']
    db.session.commit()
    return jsonify({'id': task.id, 'title': task.title, 'description': task.description, 'position': task.position, 'column_id': task.column_id})

@app.route('/tasks/<int:task_id>', methods=['DELETE'])
@jwt_required()
def delete_task(task_id):
    task = Task.query.get_or_404(task_id)
    db.session.delete(task)
    db.session.commit()
    return jsonify({'message': 'Задача удалена'})

if __name__ == '__main__':
    app.run(debug=True)
=======
>>>>>>> 9e8bf70 (Добавить модели User, Board, Column, Task)
=======
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
>>>>>>> a130927 (Добавить login и register api эндпоинты)
